package com.example.users.entities;

import com.example.users.dto.PhoneDto;


import javax.persistence.*;
import java.util.List;

@Entity
@Table(name= "USER")
public class User {

    private String name;

    private String email;
    private String password;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    @Id
    private String id;


    public List<Phone> getPhones() {
        return phones;
    }

    public void setPhones(List<Phone> phones) {
        this.phones = phones;
    }

    @OneToMany(cascade=CascadeType.ALL,fetch = FetchType.LAZY)
    private List<Phone> phones;

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }



}
