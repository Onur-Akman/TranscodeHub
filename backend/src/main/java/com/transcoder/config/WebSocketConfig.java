package com.transcoder.config;

import com.transcoder.service.WatchPartyWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final WatchPartyWebSocketHandler watchPartyHandler;

    public WebSocketConfig(WatchPartyWebSocketHandler watchPartyHandler) {
        this.watchPartyHandler = watchPartyHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(watchPartyHandler, "/ws/watch-party/{roomId}")
                .setAllowedOrigins("*");
    }
}
