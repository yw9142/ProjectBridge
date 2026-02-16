package com.bridge.backend.domain.post;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.PostType;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.notification.OutboxService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class PostController {
    private final PostRepository postRepository;
    private final PostCommentRepository postCommentRepository;
    private final AccessGuardService guardService;
    private final OutboxService outboxService;

    public PostController(PostRepository postRepository,
                          PostCommentRepository postCommentRepository,
                          AccessGuardService guardService,
                          OutboxService outboxService) {
        this.postRepository = postRepository;
        this.postCommentRepository = postCommentRepository;
        this.guardService = guardService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/posts")
    public ApiSuccess<List<PostEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(postRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId()));
    }

    @PostMapping("/api/projects/{projectId}/posts")
    public ApiSuccess<PostEntity> create(@PathVariable UUID projectId, @RequestBody @Valid PostRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER));
        PostEntity post = new PostEntity();
        post.setTenantId(principal.getTenantId());
        post.setProjectId(projectId);
        post.setType(request.type());
        post.setTitle(request.title());
        post.setBody(request.body());
        post.setPinned(Boolean.TRUE.equals(request.pinned()));
        post.setCreatedBy(principal.getUserId());
        post.setUpdatedBy(principal.getUserId());
        PostEntity saved = postRepository.save(post);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "post", saved.getId(),
                "post.created", "Post created", saved.getTitle(), Map.of("projectId", projectId));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/posts/{postId}")
    public ApiSuccess<PostEntity> get(@PathVariable UUID postId) {
        var principal = SecurityUtils.requirePrincipal();
        PostEntity post = requireActivePost(postId);
        guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(post);
    }

    @PatchMapping("/api/posts/{postId}")
    public ApiSuccess<PostEntity> patch(@PathVariable UUID postId, @RequestBody PostPatchRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        PostEntity post = requireActivePost(postId);
        guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (request.title() != null) post.setTitle(request.title());
        if (request.body() != null) post.setBody(request.body());
        if (request.pinned() != null) post.setPinned(request.pinned());
        post.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(postRepository.save(post));
    }

    @DeleteMapping("/api/posts/{postId}")
    public ApiSuccess<Map<String, Object>> delete(@PathVariable UUID postId) {
        var principal = SecurityUtils.requirePrincipal();
        PostEntity post = requireActivePost(postId);
        guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        post.setDeletedAt(OffsetDateTime.now());
        post.setUpdatedBy(principal.getUserId());
        postRepository.save(post);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    @GetMapping("/api/posts/{postId}/comments")
    public ApiSuccess<List<PostCommentEntity>> comments(@PathVariable UUID postId) {
        var principal = SecurityUtils.requirePrincipal();
        PostEntity post = requireActivePost(postId);
        guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(postCommentRepository.findByPostIdAndTenantIdAndDeletedAtIsNull(postId, principal.getTenantId()));
    }

    @PostMapping("/api/posts/{postId}/comments")
    public ApiSuccess<PostCommentEntity> createComment(@PathVariable UUID postId, @RequestBody @Valid CommentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        PostEntity post = requireActivePost(postId);
        guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        PostCommentEntity comment = new PostCommentEntity();
        comment.setTenantId(principal.getTenantId());
        comment.setPostId(postId);
        comment.setBody(request.body());
        comment.setCreatedBy(principal.getUserId());
        comment.setUpdatedBy(principal.getUserId());
        PostCommentEntity saved = postCommentRepository.save(comment);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "post_comment", saved.getId(),
                "post.comment.created", "Comment created", post.getTitle(), Map.of("postId", postId));
        return ApiSuccess.of(saved);
    }

    @PatchMapping("/api/post-comments/{commentId}")
    public ApiSuccess<PostCommentEntity> patchComment(@PathVariable UUID commentId, @RequestBody @Valid CommentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        PostCommentEntity comment = requireActiveComment(commentId);
        PostEntity post = requireActivePost(comment.getPostId());
        var member = guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (!principal.getUserId().equals(comment.getCreatedBy()) && !isPmRole(member.getRole())) {
            throw new AppException(HttpStatus.FORBIDDEN, "COMMENT_EDIT_FORBIDDEN", "댓글 수정 권한이 없습니다.");
        }
        comment.setBody(request.body());
        comment.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(postCommentRepository.save(comment));
    }

    @DeleteMapping("/api/post-comments/{commentId}")
    public ApiSuccess<Map<String, Object>> deleteComment(@PathVariable UUID commentId) {
        var principal = SecurityUtils.requirePrincipal();
        PostCommentEntity comment = requireActiveComment(commentId);
        PostEntity post = requireActivePost(comment.getPostId());
        var member = guardService.requireProjectMember(post.getProjectId(), principal.getUserId(), principal.getTenantId());
        if (!principal.getUserId().equals(comment.getCreatedBy()) && !isPmRole(member.getRole())) {
            throw new AppException(HttpStatus.FORBIDDEN, "COMMENT_DELETE_FORBIDDEN", "댓글 삭제 권한이 없습니다.");
        }
        comment.setDeletedAt(OffsetDateTime.now());
        comment.setUpdatedBy(principal.getUserId());
        postCommentRepository.save(comment);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    private PostEntity requireActivePost(UUID postId) {
        PostEntity post = postRepository.findById(postId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다."));
        if (post.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
        }
        return post;
    }

    private PostCommentEntity requireActiveComment(UUID commentId) {
        PostCommentEntity comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다."));
        if (comment.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
        }
        return comment;
    }

    private boolean isPmRole(MemberRole role) {
        return role == MemberRole.PM_OWNER || role == MemberRole.PM_MEMBER;
    }

    public record PostRequest(PostType type, @NotBlank String title, @NotBlank String body, Boolean pinned) {
    }

    public record PostPatchRequest(String title, String body, Boolean pinned) {
    }

    public record CommentRequest(@NotBlank String body) {
    }
}
