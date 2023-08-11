package com.example.users.repository;

import com.example.users.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;


public interface UserRepository extends JpaRepository<User,String> {
    @Query(value="select id from User where email = :email and password =:password")
    public List<String> login(@Param("email") String email,@Param("password") String password);

    @Query(value="select id from User where email = :email")
    public List<String> exist(@Param("email") String email);
   }
