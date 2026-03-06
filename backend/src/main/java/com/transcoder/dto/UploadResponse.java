package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "File upload response")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UploadResponse {

    @Schema(description = "Status message", example = "Video uploaded successfully")
    private String message;

    @Schema(description = "Uploaded file name", example = "my_video.mp4")
    private String fileName;
}
