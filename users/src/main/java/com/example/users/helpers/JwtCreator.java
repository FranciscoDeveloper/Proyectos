package com.example.users.helpers;


import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Random;
import java.util.UUID;

public class JwtCreator {
    private static String secret = "asdfSFS34wfsdfsdfSDSD32dfsddDDerQSNCK34SOWEK5354fdgdf4";

    private static Key hmacKey = new SecretKeySpec(Base64.getDecoder().decode(secret),
            SignatureAlgorithm.HS256.getJcaName());
    public static  String create(String nombre,String email,String id){

        String jwtToken = Jwts.builder()
                .claim("name", nombre)
                .claim("email", email)
                .setSubject("jane")
                .setId(id)
                .setIssuedAt(Date.from(Instant.now()))
                .signWith(SignatureAlgorithm.HS256,hmacKey)
                .compact();
       return jwtToken;
    }

    public static Jws<Claims> parseJwt(String jwtString) {


        Jws<Claims> jwt = Jwts.parser()
                .setSigningKey(hmacKey)
                .parseClaimsJws(jwtString);
        Random r = new Random();
        secret = secret.substring(0,secret.length()-2)+r.nextInt(99);
        return jwt;
    }
}
