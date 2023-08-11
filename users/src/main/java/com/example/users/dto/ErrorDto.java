package com.example.users.dto;

import java.io.Serializable;
import java.sql.Timestamp;

public class ErrorDto extends  ResponseDto  {
    private Timestamp timestamp;

    public Timestamp getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Timestamp timestamp) {
        this.timestamp = timestamp;
    }

    public int getCodigo() {
        return codigo;
    }

    public void setCodigo(int codigo) {
        this.codigo = codigo;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
        super.setMessage(detail);
    }

    private int codigo;
    private String detail;
}

