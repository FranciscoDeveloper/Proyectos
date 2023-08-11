package com.example.users.dto;

import java.io.Serializable;

public class ResponseDto implements Serializable {
    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    private String message;
}
