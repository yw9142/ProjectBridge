package com.bridge.backend.common.api;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        this.mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void wrapsAppExceptionUnderErrorObject() throws Exception {
        mockMvc.perform(get("/test/app-ex"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("권한이 없습니다."))
                .andExpect(jsonPath("$.error.details.reason").value("role"));
    }

    @Test
    void wrapsValidationErrorUnderErrorObject() throws Exception {
        mockMvc.perform(post("/test/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("입력값이 유효하지 않습니다."))
                .andExpect(jsonPath("$.error.details.loginId").isNotEmpty());
    }

    @Test
    void hidesInternalExceptionMessage() throws Exception {
        mockMvc.perform(get("/test/internal-ex"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.error.message").value("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    }

    @Test
    void wrapsConstraintViolationWithValidationMessageAndDetails() throws Exception {
        mockMvc.perform(get("/test/constraint-ex"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("입력값이 유효하지 않습니다."))
                .andExpect(jsonPath("$.error.details.setupCode").value("설정 코드는 필수입니다."));
    }

    @RestController
    static class TestController {

        @GetMapping("/test/app-ex")
        public String appException() {
            throw new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다.", java.util.Map.of("reason", "role"));
        }

        @PostMapping("/test/validation")
        public String validation(@RequestBody @Valid ValidationRequest request) {
            return request.loginId();
        }

        @GetMapping("/test/internal-ex")
        public String internalException() {
            throw new RuntimeException("sensitive stack message");
        }

        @GetMapping("/test/constraint-ex")
        public String constraintException() {
            @SuppressWarnings("unchecked")
            ConstraintViolation<Object> violation = (ConstraintViolation<Object>) mock(ConstraintViolation.class);
            Path path = mock(Path.class);
            when(path.toString()).thenReturn("firstPassword.setupCode");
            when(violation.getPropertyPath()).thenReturn(path);
            when(violation.getMessage()).thenReturn("설정 코드는 필수입니다.");
            throw new ConstraintViolationException(Set.of(violation));
        }
    }

    record ValidationRequest(@NotBlank String loginId) {
    }
}
