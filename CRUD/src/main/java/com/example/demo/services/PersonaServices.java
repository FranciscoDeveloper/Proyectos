package com.example.demo.services;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.example.demo.model.Persona;
import com.example.demo.repository.PersonaRepository;


@Service
public class PersonaServices {

	@Autowired
	PersonaRepository personaRepository;
	
	public void crearPersona(Persona persona) {
		personaRepository.save(persona);
	}
	
	public void editarPersona(Persona persona) {
		personaRepository.save(persona);
	}
	
	public void removerPersona(Persona persona) {
		personaRepository.delete(persona);
	}
	
	public List<Persona> listarPersonas(){
		return personaRepository.findAll();
	}
}
