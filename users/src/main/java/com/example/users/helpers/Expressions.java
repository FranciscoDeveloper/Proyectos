package com.example.users.helpers;

public  class Expressions {

    public static final String password ="^(?=.*[A-Z])(?=(?:.*\\d){2})(?=[a-z]*)(?!.*[^A-Za-z\\d]).{8,12}$";
//esto podria ir en una base de datos noSQL si se gestionaran las politicas de contraseña
}
