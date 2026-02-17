package com.bridge.backend.domain.file;

import com.bridge.backend.common.api.ApiSuccess;
import com.bridge.backend.common.api.AppException;
import com.bridge.backend.common.model.enums.FileCommentStatus;
import com.bridge.backend.common.model.enums.MemberRole;
import com.bridge.backend.common.model.enums.VisibilityScope;
import com.bridge.backend.common.security.SecurityUtils;
import com.bridge.backend.common.tenant.AccessGuardService;
import com.bridge.backend.domain.notification.OutboxService;
import com.bridge.backend.domain.project.ProjectMemberEntity;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class FileController {
    private final FileRepository fileRepository;
    private final FileVersionRepository fileVersionRepository;
    private final FileCommentRepository fileCommentRepository;
    private final AccessGuardService guardService;
    private final StorageService storageService;
    private final OutboxService outboxService;

    public FileController(FileRepository fileRepository,
                          FileVersionRepository fileVersionRepository,
                          FileCommentRepository fileCommentRepository,
                          AccessGuardService guardService,
                          StorageService storageService,
                          OutboxService outboxService) {
        this.fileRepository = fileRepository;
        this.fileVersionRepository = fileVersionRepository;
        this.fileCommentRepository = fileCommentRepository;
        this.guardService = guardService;
        this.storageService = storageService;
        this.outboxService = outboxService;
    }

    @GetMapping("/api/projects/{projectId}/files")
    public ApiSuccess<List<FileEntity>> list(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        ProjectMemberEntity member = guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        List<FileEntity> files = fileRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId());
        if (isClientRole(member.getRole())) {
            files = files.stream()
                    .filter(file -> file.getVisibilityScope() != VisibilityScope.INTERNAL)
                    .toList();
        }
        return ApiSuccess.of(files);
    }

    @PostMapping("/api/projects/{projectId}/files")
    public ApiSuccess<FileEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateFileRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ProjectMemberEntity member = guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER));
        VisibilityScope visibilityScope = resolveVisibilityScope(request.visibilityScope());
        if (isClientRole(member.getRole()) && visibilityScope == VisibilityScope.INTERNAL) {
            throw new AppException(HttpStatus.FORBIDDEN, "FILE_VISIBILITY_FORBIDDEN", "클라이언트는 내부용 파일을 생성할 수 없습니다.");
        }
        FileEntity file = new FileEntity();
        file.setTenantId(principal.getTenantId());
        file.setProjectId(projectId);
        file.setName(request.name());
        file.setDescription(request.description());
        file.setFolder(request.folder() == null ? "/" : request.folder());
        file.setVisibilityScope(visibilityScope);
        file.setCreatedBy(principal.getUserId());
        file.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(fileRepository.save(file));
    }

    @PatchMapping("/api/files/{fileId}")
    public ApiSuccess<FileEntity> patchFile(@PathVariable UUID fileId, @RequestBody PatchFileRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        FileEntity file = requireActiveFile(fileId);
        guardService.requireProjectMemberRole(file.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        if (request.name() != null) {
            file.setName(request.name());
        }
        if (request.description() != null) {
            file.setDescription(request.description());
        }
        if (request.folder() != null) {
            file.setFolder(request.folder());
        }
        if (request.visibilityScope() != null) {
            file.setVisibilityScope(request.visibilityScope());
        }
        file.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(fileRepository.save(file));
    }

    @DeleteMapping("/api/files/{fileId}")
    public ApiSuccess<Map<String, Object>> deleteFile(@PathVariable UUID fileId) {
        var principal = SecurityUtils.requirePrincipal();
        FileEntity file = requireActiveFile(fileId);
        guardService.requireProjectMemberRole(file.getProjectId(), principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));
        file.setDeletedAt(OffsetDateTime.now());
        file.setUpdatedBy(principal.getUserId());
        fileRepository.save(file);
        return ApiSuccess.of(Map.of("deleted", true));
    }

    @GetMapping("/api/files/{fileId}/versions")
    public ApiSuccess<List<FileVersionEntity>> versions(@PathVariable UUID fileId) {
        var principal = SecurityUtils.requirePrincipal();
        FileEntity file = requireActiveFile(fileId);
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(fileVersionRepository.findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(fileId, principal.getTenantId()));
    }

    @GetMapping("/api/projects/{projectId}/file-versions")
    public ApiSuccess<List<FileVersionSummary>> fileVersionsByProject(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        ProjectMemberEntity member = guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        List<FileEntity> files = fileRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId());
        if (isClientRole(member.getRole())) {
            files = files.stream()
                    .filter(file -> file.getVisibilityScope() != VisibilityScope.INTERNAL)
                    .toList();
        }
        List<FileVersionSummary> summaries = new ArrayList<>();
        for (FileEntity file : files) {
            List<FileVersionEntity> versions = fileVersionRepository
                    .findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(file.getId(), principal.getTenantId());
            for (FileVersionEntity version : versions) {
                summaries.add(new FileVersionSummary(
                        version.getId(),
                        file.getId(),
                        file.getName(),
                        version.getVersion(),
                        version.isLatest(),
                        version.getContentType(),
                        version.getSize(),
                        version.getCreatedAt()
                ));
            }
        }
        return ApiSuccess.of(summaries);
    }

    @PostMapping("/api/files/{fileId}/versions/presign")
    public ApiSuccess<Map<String, Object>> presign(@PathVariable UUID fileId, @RequestBody @Valid PresignRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        FileEntity file = requireActiveFile(fileId);
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        int nextVersion = fileVersionRepository.findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(fileId, principal.getTenantId())
                .stream()
                .findFirst()
                .map(v -> v.getVersion() + 1)
                .orElse(1);
        return ApiSuccess.of(storageService.createUploadPresign(fileId, nextVersion, request.contentType()));
    }

    @PostMapping("/api/files/{fileId}/versions/complete")
    public ApiSuccess<FileVersionEntity> complete(@PathVariable UUID fileId, @RequestBody @Valid CompleteRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        FileEntity file = requireActiveFile(fileId);
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        fileVersionRepository.findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(fileId, principal.getTenantId())
                .forEach(v -> {
                    if (v.isLatest()) {
                        v.setLatest(false);
                        fileVersionRepository.save(v);
                    }
                });
        FileVersionEntity version = new FileVersionEntity();
        version.setTenantId(principal.getTenantId());
        version.setFileId(fileId);
        version.setVersion(request.version());
        version.setObjectKey(request.objectKey());
        version.setContentType(request.contentType());
        version.setSize(request.size());
        version.setChecksum(request.checksum());
        version.setLatest(true);
        version.setCreatedBy(principal.getUserId());
        version.setUpdatedBy(principal.getUserId());
        FileVersionEntity saved = fileVersionRepository.save(version);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "file_version", saved.getId(),
                "file.version.created", "File version uploaded", file.getName(), Map.of("fileId", fileId, "version", saved.getVersion()));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/file-versions/{fileVersionId}/download-url")
    public ApiSuccess<Map<String, Object>> downloadUrl(@PathVariable UUID fileVersionId) {
        var principal = SecurityUtils.requirePrincipal();
        FileVersionEntity version = fileVersionRepository.findById(fileVersionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "파일 버전을 찾을 수 없습니다."));
        if (version.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "파일 버전을 찾을 수 없습니다.");
        }
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(Map.of("downloadUrl", storageService.createDownloadPresign(version.getObjectKey())));
    }

    @PostMapping("/api/file-versions/{fileVersionId}/comments")
    public ApiSuccess<FileCommentEntity> comment(@PathVariable UUID fileVersionId, @RequestBody @Valid CreateCommentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        FileVersionEntity version = fileVersionRepository.findById(fileVersionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "파일 버전을 찾을 수 없습니다."));
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        FileCommentEntity comment = new FileCommentEntity();
        comment.setTenantId(principal.getTenantId());
        comment.setFileVersionId(fileVersionId);
        comment.setBody(request.body());
        comment.setCoordX(request.coordX());
        comment.setCoordY(request.coordY());
        comment.setCoordW(request.coordW());
        comment.setCoordH(request.coordH());
        comment.setCreatedBy(principal.getUserId());
        comment.setUpdatedBy(principal.getUserId());
        FileCommentEntity saved = fileCommentRepository.save(comment);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "file_comment", saved.getId(),
                "file.comment.created", "File comment created", request.body(), Map.of("fileVersionId", fileVersionId));
        return ApiSuccess.of(saved);
    }

    @GetMapping("/api/file-versions/{fileVersionId}/comments")
    public ApiSuccess<List<FileCommentEntity>> comments(@PathVariable UUID fileVersionId) {
        var principal = SecurityUtils.requirePrincipal();
        FileVersionEntity version = fileVersionRepository.findById(fileVersionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "파일 버전을 찾을 수 없습니다."));
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(fileCommentRepository.findByFileVersionIdAndTenantIdAndDeletedAtIsNull(fileVersionId, principal.getTenantId()));
    }

    @PatchMapping("/api/file-comments/{commentId}/resolve")
    public ApiSuccess<FileCommentEntity> resolve(@PathVariable UUID commentId) {
        var principal = SecurityUtils.requirePrincipal();
        FileCommentEntity comment = fileCommentRepository.findById(commentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_COMMENT_NOT_FOUND", "파일 코멘트를 찾을 수 없습니다."));
        if (comment.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_COMMENT_NOT_FOUND", "파일 코멘트를 찾을 수 없습니다.");
        }
        FileVersionEntity version = fileVersionRepository.findById(comment.getFileVersionId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "파일 버전을 찾을 수 없습니다."));
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        comment.setStatus(FileCommentStatus.RESOLVED);
        comment.setUpdatedBy(principal.getUserId());
        FileCommentEntity saved = fileCommentRepository.save(comment);
        outboxService.publish(principal.getTenantId(), principal.getUserId(), "file_comment", saved.getId(),
                "file.comment.resolved", "File comment resolved", "resolved", Map.of("commentId", saved.getId()));
        return ApiSuccess.of(saved);
    }

    private FileEntity requireActiveFile(UUID fileId) {
        FileEntity file = fileRepository.findById(fileId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "파일을 찾을 수 없습니다."));
        if (file.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "파일을 찾을 수 없습니다.");
        }
        return file;
    }

    private ProjectMemberEntity requireVisibleFileMember(FileEntity file, UUID userId, UUID tenantId) {
        ProjectMemberEntity member = guardService.requireProjectMember(file.getProjectId(), userId, tenantId);
        ensureVisibleToMember(file, member);
        return member;
    }

    private void ensureVisibleToMember(FileEntity file, ProjectMemberEntity member) {
        if (isClientRole(member.getRole()) && file.getVisibilityScope() == VisibilityScope.INTERNAL) {
            throw new AppException(HttpStatus.FORBIDDEN, "FILE_NOT_VISIBLE", "클라이언트에게 비공개 파일입니다.");
        }
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
    }

    private VisibilityScope resolveVisibilityScope(VisibilityScope scope) {
        return scope == null ? VisibilityScope.SHARED : scope;
    }

    public record CreateFileRequest(@NotBlank String name, String description, String folder, VisibilityScope visibilityScope) {
    }

    public record PatchFileRequest(String name, String description, String folder, VisibilityScope visibilityScope) {
    }

    public record PresignRequest(@NotBlank String contentType) {
    }

    public record CompleteRequest(int version, @NotBlank String objectKey, @NotBlank String contentType, long size, @NotBlank String checksum) {
    }

    public record CreateCommentRequest(@NotBlank String body, double coordX, double coordY, double coordW, double coordH) {
    }

    public record FileVersionSummary(UUID id,
                                     UUID fileId,
                                     String fileName,
                                     int version,
                                     boolean latest,
                                     String contentType,
                                     long size,
                                     OffsetDateTime createdAt) {
    }
}
