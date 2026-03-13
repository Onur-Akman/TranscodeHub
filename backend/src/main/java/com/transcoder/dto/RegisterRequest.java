package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Register request")
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

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
