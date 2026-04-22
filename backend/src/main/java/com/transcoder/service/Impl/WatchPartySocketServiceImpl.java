package com.transcoder.service.Impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.transcoder.config.JwtUtil;
import com.transcoder.service.WatchPartySocketService;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

@Service
public class WatchPartySocketServiceImpl extends TextWebSocketHandler implements WatchPartySocketService {

    private final JwtUtil jwtUtil;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ConcurrentHashMap<String, RoomState> rooms = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public WatchPartySocketServiceImpl(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
        scheduler.scheduleAtFixedRate(this::broadcastSync, 3, 3, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String roomId = extractRoomId(session);
        String token = extractToken(session);

        if (roomId == null || token == null || !jwtUtil.isValid(token)) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        String username = jwtUtil.getUsername(token);
        session.getAttributes().put("username", username);
        session.getAttributes().put("roomId", roomId);

        RoomState room = rooms.computeIfAbsent(roomId, RoomState::new);
        room.addUser(username, session);

        sendTo(session, Map.of(
                "type", "JOINED",
                "username", username,
                "users", room.getUsernames(),
                "serverTime", System.currentTimeMillis(),
                "videoState", room.getVideoStateMap()));

        broadcast(room, Map.of(
                "type", "USER_JOINED",
                "username", username,
                "users", room.getUsernames()), session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");
        if (roomId == null || username == null)
            return;

        RoomState room = rooms.get(roomId);
        if (room == null)
            return;

        Map<String, Object> msg = mapper.readValue(message.getPayload(), Map.class);
        String type = (String) msg.get("type");
        if (type == null)
            return;

        switch (type) {
            case "CHAT" -> handleChat(room, username, msg);
            case "PAUSE" -> handlePause(room, username, msg);
            case "PLAY" -> handlePlay(room, username, session);
            case "SEEK" -> handleSeek(room, username, msg);
            case "BUFFER_STATUS" -> handleBufferStatus(room, username, msg);
            case "READY" -> handleReady(room, username);
            case "REQUEST_SYNC" -> sendTo(session, Map.of(
                    "type", "SYNC",
                    "serverTime", System.currentTimeMillis(),
                    "videoState", room.getVideoStateMap()));
            case "WEBRTC_OFFER", "WEBRTC_ANSWER", "WEBRTC_ICE" -> relayToUser(room, username, msg);
            case "VOICE_STATE" -> broadcast(room, Map.of(
                    "type", "VOICE_STATE",
                    "username", username,
                    "mode", msg.getOrDefault("mode", "OFF")), null);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");
        if (roomId == null || username == null)
            return;

        RoomState room = rooms.get(roomId);
        if (room == null)
            return;

        room.removeUser(username);

        if (room.isEmpty()) {
            rooms.remove(roomId);
        } else {
            broadcast(room, Map.of(
                    "type", "USER_LEFT",
                    "username", username,
                    "users", room.getUsernames()), null);
        }
    }

    private void handleChat(RoomState room, String username, Map<String, Object> msg) {
        String text = (String) msg.get("message");
        if (text == null || text.isBlank())
            return;

        broadcast(room, Map.of(
                "type", "CHAT",
                "username", username,
                "message", text,
                "timestamp", System.currentTimeMillis()), null);
    }

    private void handlePause(RoomState room, String username, Map<String, Object> msg) {
        double position = toDouble(msg.get("position"));
        long now = System.currentTimeMillis();

        room.videoPosition = position;
        room.isPlaying = false;
        room.lastStateChangeTime = now;
        room.pausedByUser = username;
        room.pauseLockUntil = now + 120_000;
        room.readyUsers.clear();
        room.slowUserWaiting = null;

        broadcast(room, Map.of(
                "type", "PAUSE",
                "username", username,
                "position", position,
                "lockUntil", room.pauseLockUntil,
                "serverTime", now), null);
    }

    private void handlePlay(RoomState room, String username, WebSocketSession session) {
        long now = System.currentTimeMillis();

        if (room.pausedByUser != null && !room.pausedByUser.equals(username) && now < room.pauseLockUntil) {
            long remainingSec = (room.pauseLockUntil - now) / 1000;
            sendTo(session, Map.of(
                    "type", "PLAY_REJECTED",
                    "reason", room.pausedByUser + " paused. Wait " + remainingSec + "s or let them resume.",
                    "lockedBy", room.pausedByUser,
                    "lockRemainingMs", room.pauseLockUntil - now));
            return;
        }

        room.isPlaying = true;
        room.lastStateChangeTime = now;
        room.pausedByUser = null;
        room.pauseLockUntil = 0;
        room.readyUsers.clear();
        room.slowUserWaiting = null;

        broadcast(room, Map.of(
                "type", "PLAY",
                "position", room.videoPosition,
                "serverTime", now), null);
    }

    private void handleSeek(RoomState room, String username, Map<String, Object> msg) {
        double position = toDouble(msg.get("position"));
        long now = System.currentTimeMillis();

        room.videoPosition = position;
        room.lastStateChangeTime = now;
        room.readyUsers.clear();
        room.bufferStatus.clear();
        room.slowUserWaiting = null;
        room.lastSlowUserSyncTime = now;

        broadcast(room, Map.of(
                "type", "SEEK",
                "username", username,
                "position", position,
                "isPlaying", room.isPlaying,
                "serverTime", now), null);
    }

    private void handleBufferStatus(RoomState room, String username, Map<String, Object> msg) {
        double bufferedTo = toDouble(msg.get("bufferedTo"));
        double currentTime = toDouble(msg.get("currentTime"));
        room.bufferStatus.put(username, new double[] { currentTime, bufferedTo });
    }

    private void relayToUser(RoomState room, String sender, Map<String, Object> msg) {
        String target = (String) msg.get("targetUser");
        if (target == null)
            return;
        WebSocketSession targetSession = room.users.get(target);
        if (targetSession == null || !targetSession.isOpen())
            return;

        Map<String, Object> relay = new LinkedHashMap<>(msg);
        relay.put("fromUser", sender);
        sendTo(targetSession, relay);
    }

    private void handleReady(RoomState room, String username) {
        room.readyUsers.add(username);
    }

    private void broadcastSync() {
        long now = System.currentTimeMillis();
        for (RoomState room : rooms.values()) {
            if (room.isEmpty())
                continue;

            double currentPos = room.isPlaying
                    ? room.videoPosition + (now - room.lastStateChangeTime) / 1000.0
                    : room.videoPosition;


            if (room.isPlaying && !room.bufferStatus.isEmpty()
                    && now - room.lastSlowUserSyncTime > 15_000) {
                String slowestUser = null;
                double slowestPos = currentPos;

                for (Map.Entry<String, double[]> entry : room.bufferStatus.entrySet()) {
                    double userCurrentTime = entry.getValue()[0];
                    double drift = currentPos - userCurrentTime;
                    if (drift > 5.0 && userCurrentTime < slowestPos) {
                        slowestUser = entry.getKey();
                        slowestPos = userCurrentTime;
                    }
                }

                if (slowestUser != null) {
                    room.videoPosition = slowestPos;
                    room.isPlaying = false;
                    room.lastStateChangeTime = now;
                    room.pausedByUser = null;
                    room.pauseLockUntil = 0;
                    room.lastSlowUserSyncTime = now;
                    room.slowUserWaiting = slowestUser;

                    broadcast(room, Map.of(
                            "type", "SLOW_USER",
                            "username", slowestUser,
                            "position", slowestPos,
                            "serverTime", now), null);
                    continue;
                }
            }


            if (!room.isPlaying && room.slowUserWaiting != null) {
                double[] buf = room.bufferStatus.get(room.slowUserWaiting);
                if (buf != null) {
                    double bufferedTo = buf[1];
                    double ahead = bufferedTo - room.videoPosition;
                    if (ahead >= 3.0) {
                        room.isPlaying = true;
                        room.lastStateChangeTime = now;
                        String recovered = room.slowUserWaiting;
                        room.slowUserWaiting = null;

                        broadcast(room, Map.of(
                                "type", "SLOW_USER_RECOVERED",
                                "username", recovered,
                                "position", room.videoPosition,
                                "serverTime", now), null);
                        continue;
                    }
                }
            }

            Map<String, Object> syncMsg = new LinkedHashMap<>();
            syncMsg.put("type", "SYNC");
            syncMsg.put("serverTime", now);
            syncMsg.put("videoState", Map.of(
                    "position", currentPos,
                    "isPlaying", room.isPlaying,
                    "pausedByUser", room.pausedByUser != null ? room.pausedByUser : "",
                    "pauseLockUntil", room.pauseLockUntil));

            broadcast(room, syncMsg, null);
        }
    }

    private void broadcast(RoomState room, Map<String, Object> msg, WebSocketSession exclude) {
        String json;
        try {
            json = mapper.writeValueAsString(msg);
        } catch (Exception e) {
            return;
        }
        TextMessage textMsg = new TextMessage(json);
        for (WebSocketSession s : room.getSessions()) {
            if (s.equals(exclude))
                continue;
            if (s.isOpen()) {
                try {
                    synchronized (s) {
                        s.sendMessage(textMsg);
                    }
                } catch (IOException ignored) {
                }
            }
        }
    }

    private void sendTo(WebSocketSession session, Map<String, Object> msg) {
        if (!session.isOpen())
            return;
        try {
            String json = mapper.writeValueAsString(msg);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException ignored) {
        }
    }

    private String extractRoomId(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String[] parts = path.split("/");
        return parts.length > 0 ? parts[parts.length - 1] : null;
    }

    private String extractToken(WebSocketSession session) {
        if (session.getUri() == null)
            return null;
        var params = UriComponentsBuilder.fromUri(session.getUri()).build().getQueryParams();
        List<String> tokens = params.get("token");
        return (tokens != null && !tokens.isEmpty()) ? tokens.get(0) : null;
    }

    private double toDouble(Object val) {
        if (val instanceof Number n)
            return n.doubleValue();
        if (val instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (Exception e) {
                return 0;
            }
        }
        return 0;
    }

    static class RoomState {
        final String roomId;
        final ConcurrentHashMap<String, WebSocketSession> users = new ConcurrentHashMap<>();
        final ConcurrentHashMap<String, double[]> bufferStatus = new ConcurrentHashMap<>();
        final Set<String> readyUsers = ConcurrentHashMap.newKeySet();

        volatile double videoPosition = 0;
        volatile boolean isPlaying = false;
        volatile long lastStateChangeTime = System.currentTimeMillis();
        volatile String pausedByUser = null;
        volatile long pauseLockUntil = 0;
        volatile long lastSlowUserSyncTime = 0;
        volatile String slowUserWaiting = null;

        RoomState(String roomId) {
            this.roomId = roomId;
        }

        void addUser(String username, WebSocketSession session) {
            users.put(username, session);
        }

        void removeUser(String username) {
            users.remove(username);
            bufferStatus.remove(username);
            readyUsers.remove(username);
        }

        boolean isEmpty() {
            return users.isEmpty();
        }

        List<String> getUsernames() {
            return new ArrayList<>(users.keySet());
        }

        Collection<WebSocketSession> getSessions() {
            return users.values();
        }

        Map<String, Object> getVideoStateMap() {
            long now = System.currentTimeMillis();
            double currentPos = isPlaying
                    ? videoPosition + (now - lastStateChangeTime) / 1000.0
                    : videoPosition;

            Map<String, Object> state = new LinkedHashMap<>();
            state.put("position", currentPos);
            state.put("isPlaying", isPlaying);
            state.put("pausedByUser", pausedByUser != null ? pausedByUser : "");
            state.put("pauseLockUntil", pauseLockUntil);
            return state;
        }
    }
}
