package com.example.users.services;

import com.example.users.dto.CreateUserResponseDto;
import com.example.users.dto.ErrorDto;
import com.example.users.dto.ResponseDto;
import com.example.users.dto.UserDto;
import com.example.users.entities.User;
import com.example.users.repository.UserRepository;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class UserService {
    ModelMapper modelMapper = new ModelMapper();
    @Autowired
    private UserRepository userRepository;


    public ResponseDto createUser(UserDto userDto){
        String successMessage= "USUARIO CREADO EXITOSAMENTE";
        User user = modelMapper.map(userDto,User.class);
        CreateUserResponseDto response = new CreateUserResponseDto();
        try {
            int conut= userRepository.exist(user.getEmail()).size();
            if (conut>0){
                ErrorDto error = new ErrorDto();
                error.setCodigo(HttpStatus.BAD_REQUEST.value());
                error.setDetail( "Usuario ya existe");
                error.setTimestamp(Timestamp.from(Instant.now()));
                return  error;
            }
            user = userRepository.save(user);
            response.setCreated(new Date());
            response.setUser(userDto);
            response.setId(user.getId());
            response.setMessage(successMessage);
            response.setIsActie(1);
            return response;
        }catch(IllegalArgumentException e){
            ErrorDto error = new ErrorDto();
            error.setCodigo(HttpStatus.BAD_REQUEST.value());
            error.setDetail( "Algun objeto esta recibiendo un argumento ilegal.");
            error.setTimestamp(Timestamp.from(Instant.now()));
            return  error;
        }

    }

    public ResponseDto login(UserDto userDto){

      List<String> ids= userRepository.login(userDto.getEmail(),userDto.getPassword());
      if (ids.size()>0){
          String id =ids.get(0);
          User user= userRepository.findById(id).get();
          userDto = modelMapper.map(user,UserDto.class);
          CreateUserResponseDto response = new CreateUserResponseDto();
          response.setUser(userDto);
          response.setId(ids.get(0));
          response.setIsActie(1);
          return response;
      }else{
          ErrorDto error = new ErrorDto();
          error.setCodigo(HttpStatus.BAD_REQUEST.value());
          error.setDetail("Error de autenticacion");
          error.setTimestamp(Timestamp.from(Instant.now()));
          return  error;
      }


    }
}
