package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "User information response")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    @Schema(description = "User ID", example = "1")
    private Long id;

    @Schema(description = "Username", example = "admin")
    private String username;

    @Schema(description = "Email", example = "admin@example.com")
    private String email;

    @Schema(description = "Phone number", example = "+905551234567")
    private String phone;

    @Schema(description = "User role", example = "ADMIN")
    private String role;

    @Schema(description = "Status message", example = "User created successfully")
    private String message;
}
