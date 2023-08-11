package com.example.users.controllers;

import com.example.users.dto.CreateUserResponseDto;
import com.example.users.dto.ErrorDto;
import com.example.users.dto.ResponseDto;
import com.example.users.dto.UserDto;
import com.example.users.helpers.JwtCreator;
import com.example.users.services.UserService;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@RestController
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping(value = "/sign-up",produces = MediaType.APPLICATION_JSON_VALUE,consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ResponseDto> signup(@Valid @RequestBody UserDto user)  {
        user.setId(UUID.randomUUID().toString());
        String token = JwtCreator.create(user.getName(),user.getEmail(),user.getId());
        ResponseDto response = userService.createUser(user);
        if(response instanceof CreateUserResponseDto){
            CreateUserResponseDto createUserResponseDto = (CreateUserResponseDto)response;
            createUserResponseDto.setToken(token);
            if (!createUserResponseDto.getId().isEmpty()){
                return new ResponseEntity<>(response, HttpStatus.OK);
            }
        }


        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);

    }

    @PostMapping(value = "/login",produces = MediaType.APPLICATION_JSON_VALUE,consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ResponseDto> login(@Valid @RequestBody UserDto user, @RequestHeader(HttpHeaders.AUTHORIZATION) String token)  {
        Claims claims = JwtCreator.parseJwt(token.split(" ")[1]).getBody();
        String id = claims.getId();
        ResponseDto response = userService.login(user);
        if(response instanceof CreateUserResponseDto){
            CreateUserResponseDto createUserResponseDto = (CreateUserResponseDto)response;
            String  UUID=createUserResponseDto.getId();
            if(id.equals(UUID)){
                createUserResponseDto.setCreated(claims.getIssuedAt());
                createUserResponseDto.setLastLogin(new Date());
                token =JwtCreator.create(user.getName(),user.getEmail(),user.getId());
                createUserResponseDto.setToken(token);
                createUserResponseDto.setMessage("Autenticacion exitosa");
                return new ResponseEntity<>(createUserResponseDto, HttpStatus.OK);
            }
        }

        ErrorDto error = new ErrorDto();
        error.setCodigo(HttpStatus.BAD_REQUEST.value());
        error.setDetail("Error de autenticacion");
        error.setTimestamp(Timestamp.from(Instant.now()));
        return new ResponseEntity<>(error, HttpStatus.OK);



    }




}
