package com.example.users.dto;

import java.io.Serializable;
import java.util.Date;

public class CreateUserResponseDto extends ResponseDto {


    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    private String id;
    private Date created;
    private Date lastLogin;
    private String token;

    public Date getCreated() {
        return created;
    }

    public void setCreated(Date created) {
        this.created = created;
    }

    public Date getLastLogin() {
        return lastLogin;
    }

    public void setLastLogin(Date lastLogin) {
        this.lastLogin = lastLogin;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public Integer getIsActie() {
        return isActie;
    }

    public void setIsActie(Integer isActie) {
        this.isActie = isActie;
    }

    public UserDto getUser() {
        return user;
    }

    public void setUser(UserDto user) {
        this.user = user;
    }

    private Integer isActie;
    private UserDto user;
}
