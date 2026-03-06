package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "Login request")
@Getter
@Setter
@NoArgsConstructor
public class LoginRequest {

    @NotBlank
    @Schema(description = "Username", example = "admin")
    private String username;

    @NotBlank
    @Schema(description = "Password", example = "admin123")
    private String password;
}
