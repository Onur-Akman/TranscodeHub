package com.transcoder.config;

import com.transcoder.service.WatchPartySocketService;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final WatchPartySocketService watchPartySocketService;

    public WebSocketConfig(WatchPartySocketService watchPartySocketService) {
        this.watchPartySocketService = watchPartySocketService;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(watchPartySocketService, "/ws/watch-party/{roomId}")
                .setAllowedOrigins("*");
    }
}
