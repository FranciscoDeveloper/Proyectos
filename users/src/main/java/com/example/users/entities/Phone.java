package com.example.users.entities;

import javax.persistence.*;
import java.io.Serializable;

@Entity
@Table(name = "PHONE")
public class Phone implements Serializable {


    private Long number;
    private Integer citycode;

    private String countrycode;;
    @Id
    @GeneratedValue(strategy= GenerationType.AUTO)
    private Long id;

    public Long getNumber() {
        return number;
    }

    public void setNumber(Long number) {
        this.number = number;
    }

    public Integer getCitycode() {
        return citycode;
    }

    public void setCitycode(Integer citycode) {
        this.citycode = citycode;
    }

    public String getCountrycode() {
        return countrycode;
    }

    public void setCountrycode(String countrycode) {
        this.countrycode = countrycode;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
