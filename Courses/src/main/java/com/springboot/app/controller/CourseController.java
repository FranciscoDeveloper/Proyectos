package com.springboot.app.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.springboot.app.dto.Course;
import com.springboot.app.repository.CourseRepository;

@RestController
@RequestMapping("/api/v1/")
// @CrossOrigin("http://localhost:8080")
public class CourseController {

	@Autowired
	CourseRepository courseRepository;

	@GetMapping(value = "/all")
	public List<Course> getAll() {
		return courseRepository.findAll();
	}

	@PostMapping(value = "/load/")
	public List<Course> persis(@RequestBody final Course users) {
		courseRepository.save(users);
		return courseRepository.findAll();
	}

	// aqui yo deberia devolver el token desde la db
	@GetMapping(value = "/load/{id}")
	public String autenticate(@PathVariable Long id) {
		return "a5f5df5dfe84zs5d45ds4sa" + id;
	}
}
