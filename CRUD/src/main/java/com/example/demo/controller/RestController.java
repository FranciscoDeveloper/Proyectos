package com.example.demo.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.example.demo.model.Persona;
import com.example.demo.services.PersonaServices;


@org.springframework.web.bind.annotation.RestController()
public class RestController {

	@Autowired
	PersonaServices personaServices;
	
	@PostMapping(path = "/crear")
	public void CrearPersona(@RequestBody Persona persona) {
		personaServices.crearPersona(persona);
	}
	
	@GetMapping()
	public List<Persona> ListarPersona(){
		return personaServices.listarPersonas();
	}
	
	@PostMapping(path = "/editar")
	public void EditarPersona(@RequestBody Persona persona) {
		personaServices.editarPersona(persona);
	}
	
	@PostMapping(path = "/borrar")
	public void EliminarPersona(@RequestBody Persona persona) {
		personaServices.editarPersona(persona);
	}
	
	
}
