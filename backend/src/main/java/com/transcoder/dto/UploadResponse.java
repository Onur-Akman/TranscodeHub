package com.transcoder.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "File upload response")
public class UploadResponse {

    @Schema(description = "Status message", example = "Video uploaded successfully")
    private String message;

    @Schema(description = "Uploaded file name", example = "my_video.mp4")
    private String fileName;

    public UploadResponse() {}

    public UploadResponse(String message, String fileName) {
        this.message = message;
        this.fileName = fileName;
    }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
}
