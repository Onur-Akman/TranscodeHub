package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "Register request")
@Getter
@Setter
@NoArgsConstructor
public class RegisterRequest {

    @NotBlank
    @Schema(description = "Username", example = "newuser")
    private String username;

    @NotBlank
    @Schema(description = "Password", example = "securePass123")
    private String password;

    @NotBlank
    @Email(message = "Invalid email format")
    @Schema(description = "Email address", example = "newuser@example.com")
    private String email;

    @NotBlank
    @Schema(description = "Phone number", example = "+905551234567")
    private String phone;
}
