package com.boxora.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.expression.ExpressionUtils;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.core.GrantedAuthorityDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.util.SimpleMethodInvocation;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Authorization BEFORE request validation.
 *
 * <p>{@code @PreAuthorize} runs when the controller method is invoked, which is after Spring MVC has parsed the
 * body and applied {@code @Valid}. A caller whose role is not allowed to use an endpoint therefore used to get a
 * 400 with the DTO's field rules ("Vui lòng nhập nhóm quyền") instead of a 403, which both leaks how the API
 * is validated and makes the permission matrix inconsistent.
 *
 * <p>This interceptor evaluates the endpoint's {@code @PreAuthorize} expression first. Only expressions that do
 * not depend on the call's arguments or on beans ({@code hasRole}, {@code hasAnyRole}, {@code hasAuthority},
 * {@code isAuthenticated}, {@code and}/{@code or}/{@code !}) are pre-checked; anything referencing {@code #param}
 * or {@code @bean} is left to the regular method security, which still evaluates every expression afterwards,
 * so this can only make a denial happen earlier, never grant anything.
 */
@Component
public class AuthorizationFirstInterceptor implements HandlerInterceptor {

    /** Marker for endpoints whose expression must be left to the regular method security. */
    private static final Object NOT_CHECKABLE = new Object();

    private final DefaultMethodSecurityExpressionHandler expressionHandler = new DefaultMethodSecurityExpressionHandler();
    /** method -> parsed expression, or {@link #NOT_CHECKABLE}. */
    private final Map<Method, Object> cache = new ConcurrentHashMap<>();

    public AuthorizationFirstInterceptor(ObjectProvider<RoleHierarchy> roleHierarchy,
                                         ObjectProvider<GrantedAuthorityDefaults> authorityDefaults) {
        RoleHierarchy hierarchy = roleHierarchy.getIfAvailable();
        if (hierarchy != null) {
            expressionHandler.setRoleHierarchy(hierarchy);
        }
        GrantedAuthorityDefaults defaults = authorityDefaults.getIfAvailable();
        if (defaults != null) {
            expressionHandler.setDefaultRolePrefix(defaults.getRolePrefix());
        }
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        Method method = AopUtils.selectInvocableMethod(handlerMethod.getMethod(), handlerMethod.getBeanType());
        Object parsed = cache.computeIfAbsent(method, this::parse);
        if (parsed == NOT_CHECKABLE) {
            return true;
        }

        Authentication authentication = currentAuthentication();
        EvaluationContext context = expressionHandler.createEvaluationContext(
                authentication, new SimpleMethodInvocation(handlerMethod.getBean(), method));
        if (!ExpressionUtils.evaluateAsBoolean((Expression) parsed, context)) {
            throw new AccessDeniedException("Access Denied");
        }
        return true;
    }

    /** The endpoint's {@code @PreAuthorize} (method first, then class) as an expression, or NOT_CHECKABLE. */
    private Object parse(Method method) {
        PreAuthorize annotation = AnnotatedElementUtils.findMergedAnnotation(method, PreAuthorize.class);
        if (annotation == null) {
            annotation = AnnotatedElementUtils.findMergedAnnotation(method.getDeclaringClass(), PreAuthorize.class);
        }
        if (annotation == null) {
            return NOT_CHECKABLE;
        }
        String expression = annotation.value();
        if (expression.contains("#") || expression.contains("@") || expression.contains("returnObject")) {
            return NOT_CHECKABLE;
        }
        try {
            return expressionHandler.getExpressionParser().parseExpression(expression);
        } catch (RuntimeException e) {
            return NOT_CHECKABLE;
        }
    }

    private static Authentication currentAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return new AnonymousAuthenticationToken("anonymous", "anonymousUser",
                    AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS"));
        }
        return authentication;
    }
}
