package com.example.users;

import com.example.users.controllers.UserController;
import com.example.users.dto.PhoneDto;
import com.example.users.dto.CreateUserResponseDto;
import com.example.users.dto.ResponseDto;
import com.example.users.dto.UserDto;
import com.example.users.entities.User;
import com.example.users.helpers.JwtCreator;
import com.example.users.repository.UserRepository;
import com.example.users.services.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import org.jetbrains.annotations.NotNull;
import org.junit.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.runner.RunWith;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.MethodArgumentNotValidException;
//import org.springframework.boot.test.mock.mockito.MockBean;
//import org.springframework.test.context.junit4.SpringRunner;


import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;



@RunWith(SpringRunner.class)
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        classes = UsersApplication.class)
@AutoConfigureMockMvc
public class UserTest {
    @TestConfiguration
    static class UserImplTestContextConfiguration {

        @Bean
        public UserService userService() {
            return new UserService();
        }
        @Bean
        public UserController userController() {
            return new UserController();
        }


    }
    @MockBean
    private UserRepository repository;

    @Autowired
    private UserService userService;

    @Autowired
    UserController userController;

    @Autowired
    MockMvc mvc;

    ModelMapper modelMapper = new ModelMapper();

    @Test
    public void whenCreateUserServiceTest() {
        UserDto userDto = prepareUserDto();
        User user = modelMapper.map(prepareUserDto(),User.class);
        when(repository.save(any())).thenReturn(user);
        CreateUserResponseDto response = (CreateUserResponseDto) userService.createUser(userDto);
        assertNotNull(response.getId());
        assertFalse(response.getId().isEmpty());
        assertEquals(user.getEmail(),response.getUser().getEmail());
        assertEquals(user.getPassword(),response.getUser().getPassword());
        assertEquals(user.getName(),response.getUser().getName());
        assertEquals(user.getPhones().get(0).getNumber(),response.getUser().getPhones().get(0).getNumber());
        assertEquals(user.getPhones().get(0).getCountrycode(),response.getUser().getPhones().get(0).getCountrycode());
        assertEquals(user.getPhones().get(0).getCitycode(),response.getUser().getPhones().get(0).getCitycode());

    }

    @Test
    public void whenValidJwt(){
        Jws<Claims> jwt = JwtCreator.parseJwt("eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSE9MQSIsImVtYWlsIjoicmlxdWVsbWUub3J0aXpAR01BSUxDT00iLCJzdWIiOiJqYW5lIiwianRpIjoiNzQzMDZmYWUtNjFjZi00MTdiLTliNDctMjU5MDE4ZDE4MDExIiwiaWF0IjoxNjkxNzI0MTc4fQ.RwqCNJLytYrxL4fstaN8noFj2ncW13l1fdr-W2JZVmg");
    }

    @Test
    public void userControllerTest() {
        UserService userService = mock(UserService.class);
        UserDto userDto = prepareUserDto();
        User user = modelMapper.map(prepareUserDto(),User.class);
        when(repository.save(any())).thenReturn(user);
        when(userService.createUser(any())).thenReturn(any());
        ResponseEntity<ResponseDto> responseEntity = userController.signup(userDto);
        assertEquals(responseEntity.getStatusCode(), HttpStatus.OK);
        ResponseDto responseDto = responseEntity.getBody();
        assertNotNull(responseDto);
        assertEquals(responseDto.getMessage(), "USUARIO CREADO EXITOSAMENTE");

    }

    @Test
    public void userAlreadyExistControllerTest() throws Exception {
        List<String> ids = new ArrayList<>();
        ids.add("test");
        when(repository.exist(any())).thenReturn(ids);
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        UserDto userDto =UserDto.builder().id(UUID.randomUUID().toString()).email("riquelme.ortiz@gmail.com").name("Francisco").password("Ab12cdEf34").phones(listPhone).build();
        mvc.perform(MockMvcRequestBuilders.post("/sign-up")
                        .contentType("application/json").content(asJsonString(userDto)))
                .andExpect(status().isBadRequest()).andExpect(MockMvcResultMatchers.jsonPath("message").value("Usuario ya existe"));

    }
    @Test
    public void whenEmailErrorControllerTest() throws Exception {
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        UserDto userDto =UserDto.builder().id(UUID.randomUUID().toString()).email("riquelme.ortizgmail.com").name("Francisco").password("a2asfGfdfdf4").phones(listPhone).build();
        mvc.perform(MockMvcRequestBuilders.post("/sign-up")
                        .contentType("application/json").content(asJsonString(userDto)))
                .andExpect(status().isBadRequest())
                .andExpect(result -> assertTrue(result.getResolvedException() instanceof MethodArgumentNotValidException));
    }

    @Test
    public void whenBadRequestLoginControllerTest() throws Exception {
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        UserDto userDto =UserDto.builder().id(UUID.randomUUID().toString()).email("riquelme.ortizgmail.com").name("Francisco").password("a2asfGfdfdf4").phones(listPhone).build();
        mvc.perform(MockMvcRequestBuilders.post("/login").header("AUTHORIZATION","eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSE9MQSIsImVtYWlsIjoicmlxdWVsbWUub3J0aXpAR01BSUxDT00iLCJzdWIiOiJqYW5lIiwianRpIjoiNzQzMDZmYWUtNjFjZi00MTdiLTliNDctMjU5MDE4ZDE4MDExIiwiaWF0IjoxNjkxNzI0MTc4fQ.RwqCNJLytYrxL4fstaN8noFj2ncW13l1fdr-W2JZVmg")
                        .contentType("application/json").content(asJsonString(userDto)))
                .andExpect(status().isBadRequest())
                .andExpect(result -> assertTrue(result.getResolvedException() instanceof MethodArgumentNotValidException));

    }

    @Test
    public void whenPasswordErrorControllerTest() throws Exception {
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        UserDto userDto =UserDto.builder().id(UUID.randomUUID().toString()).email("riquelme.ortiz@gmail.com").name("Francisco").password("1234").phones(listPhone).build();
        mvc.perform(MockMvcRequestBuilders.post("/sign-up")
                        .contentType("application/json").content(asJsonString(userDto)))
                .andExpect(status().isBadRequest())
                .andExpect(result -> assertTrue(result.getResolvedException() instanceof MethodArgumentNotValidException));
    }

    @Test
    public void whenValidUserControllerTest() throws Exception {
        User user = modelMapper.map(prepareUserDto(),User.class);
        when(repository.save(any())).thenReturn(user);
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        UserDto userDto =UserDto.builder().id(UUID.randomUUID().toString()).email("riquelme.ortiz@gmail.com").name("Francisco").password("Ab12cdEf34").phones(listPhone).build();
        mvc.perform(MockMvcRequestBuilders.post("/sign-up")
                        .contentType("application/json").content(asJsonString(userDto)))
                .andExpect(status().isOk());
    }

    @Test
    public void whenIllegalArgumentExceptionUserServiceTest(){
        when(repository.save(any())).thenThrow(IllegalArgumentException.class);
        UserDto userDto = prepareUserDto();
        ResponseDto responseDto = userService.createUser(userDto);
        assertEquals("Algun objeto esta recibiendo un argumento ilegal.",responseDto.getMessage());
    }
    @Test
    public void MapperTest(){
        ModelMapper modelMapper = new ModelMapper();
        UserDto userDto= prepareUserDto();
        User user = modelMapper.map(prepareUserDto(),User.class);
        assertEquals(user.getEmail(),userDto.getEmail());
        assertEquals(user.getPassword(),userDto.getPassword());
        assertEquals(user.getName(),userDto.getName());
        assertEquals(user.getPhones().get(0).getNumber(),userDto.getPhones().get(0).getNumber());
        assertEquals(user.getPhones().get(0).getCountrycode(),userDto.getPhones().get(0).getCountrycode());
        assertEquals(user.getPhones().get(0).getCitycode(),userDto.getPhones().get(0).getCitycode());
    }
    private @NotNull UserDto prepareUserDto(){

        UserDto userDto = new UserDto();
        userDto.setId(UUID.randomUUID().toString());
        userDto.setEmail("riquelme.ortiz@gmail.com");
        userDto.setName("Francisco");
        userDto.setPassword("1234");
        PhoneDto phone = new PhoneDto();
        phone.setCitycode(56);
        phone.setCountrycode("CL");
        phone.setNumber(933835408L);
        List<PhoneDto> listPhone = new ArrayList<>();
        listPhone.add(phone);
        userDto.setPhones(listPhone);
        return userDto;
    }

    public static String asJsonString(final Object obj) {
        try {
            return new ObjectMapper().writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

}
