package com.springboot.app.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.app.repository.StudentRepository;

@RestController
@RequestMapping("/api/v1/")

public class StudentController {
	
	
	@Autowired
	StudentRepository courseRepository;
	@RequestMapping("/")
	public String index() {
		return "<b>Greetings from Spring Boot!<b>";
	}

	// Esto crea un get a la direccion http://localhost:8080/home devolviendo el
	// json {"nombre": "World"}
	// @CrossOrigin("http://localhost:8080")
	@GetMapping("/student")
	public Object home(@RequestParam(value = "nombre", defaultValue = "World") String nombre,
			@RequestHeader("Authorization") String token) {
		
		return null;
	}

	// Esto crea un post misma url pero le mandas el json
	@PostMapping("/home")
	public Object createHome(@RequestBody Object home) {
		System.out.println("create");
		return home;
	}

	@PutMapping("/home/{id}")
	public Object updateHome(@RequestBody Object home, @PathVariable Long id) {
		System.out.println("update" + id);
		return home;

	}
}
