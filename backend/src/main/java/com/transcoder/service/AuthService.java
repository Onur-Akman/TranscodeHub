package com.transcoder.service;

import com.transcoder.dto.LoginRequest;
import com.transcoder.dto.LoginResponse;
import com.transcoder.dto.RegisterRequest;
import com.transcoder.dto.UserResponse;

import java.util.List;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    UserResponse getCurrentUser(String username);

    UserResponse register(RegisterRequest request);

    List<UserResponse> listUsers();
}
