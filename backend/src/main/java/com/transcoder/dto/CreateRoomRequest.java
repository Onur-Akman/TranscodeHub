package com.transcoder.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateRoomRequest {

    @NotBlank
    private String movieImdbId;

    @NotNull
    private Long transcodeJobId;
}
