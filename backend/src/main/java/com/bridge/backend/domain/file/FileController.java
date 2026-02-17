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
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class FileController {
    private final FileRepository fileRepository;
    private final FileFolderRepository fileFolderRepository;
    private final FileVersionRepository fileVersionRepository;
    private final FileCommentRepository fileCommentRepository;
    private final AccessGuardService guardService;
    private final StorageService storageService;
    private final OutboxService outboxService;

    public FileController(FileRepository fileRepository,
                          FileFolderRepository fileFolderRepository,
                          FileVersionRepository fileVersionRepository,
                          FileCommentRepository fileCommentRepository,
                          AccessGuardService guardService,
                          StorageService storageService,
                          OutboxService outboxService) {
        this.fileRepository = fileRepository;
        this.fileFolderRepository = fileFolderRepository;
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

    @GetMapping("/api/projects/{projectId}/file-folders")
    public ApiSuccess<List<FileFolderEntity>> listFolders(@PathVariable UUID projectId) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMember(projectId, principal.getUserId(), principal.getTenantId());
        List<FileFolderEntity> folders = fileFolderRepository.findByProjectIdAndTenantIdAndDeletedAtIsNullOrderByPathAsc(projectId, principal.getTenantId());
        return ApiSuccess.of(folders);
    }

    @PostMapping("/api/projects/{projectId}/file-folders")
    public ApiSuccess<FileFolderEntity> createFolder(@PathVariable UUID projectId, @RequestBody @Valid CreateFolderRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));

        String parentPath = normalizeFolderPath(request.parentPath());
        if (!"/".equals(parentPath) && fileFolderRepository.findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), parentPath).isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_PARENT_NOT_FOUND", "?곸쐞 ?대뜑瑜?李얠쓣 ???놁뒿?덈떎.");
        }

        String folderName = normalizeFolderName(request.name());
        String path = buildFolderPath(parentPath, folderName);
        if (fileFolderRepository.existsByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), path)) {
            throw new AppException(HttpStatus.CONFLICT, "FOLDER_ALREADY_EXISTS", "?대? ?숈씪???대뜑媛 議댁옱?⑸땲??");
        }

        FileFolderEntity folder = new FileFolderEntity();
        folder.setTenantId(principal.getTenantId());
        folder.setProjectId(projectId);
        folder.setPath(path);
        folder.setCreatedBy(principal.getUserId());
        folder.setUpdatedBy(principal.getUserId());
        return ApiSuccess.of(fileFolderRepository.save(folder));
    }

    @PostMapping("/api/projects/{projectId}/file-folders/rename")
    public ApiSuccess<Map<String, Object>> renameFolder(@PathVariable UUID projectId, @RequestBody @Valid RenameFolderRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));

        String sourcePath = normalizeFolderPath(request.sourcePath());
        if ("/".equals(sourcePath)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_RENAME_FORBIDDEN", "루트 폴더는 수정할 수 없습니다.");
        }
        fileFolderRepository.findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), sourcePath)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FOLDER_NOT_FOUND", "수정할 폴더를 찾을 수 없습니다."));

        String destinationPath = buildFolderPath(parentFolderPath(sourcePath), normalizeFolderName(request.name()));
        return ApiSuccess.of(relocateFolderTree(projectId, principal.getTenantId(), principal.getUserId(), sourcePath, destinationPath));
    }

    @PostMapping("/api/projects/{projectId}/file-folders/move")
    public ApiSuccess<Map<String, Object>> moveFolder(@PathVariable UUID projectId, @RequestBody @Valid MoveFolderRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));

        String sourcePath = normalizeFolderPath(request.sourcePath());
        String targetPath = normalizeFolderPath(request.targetPath());
        if ("/".equals(sourcePath)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_MOVE_FORBIDDEN", "루트 폴더는 이동할 수 없습니다.");
        }

        fileFolderRepository.findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), sourcePath)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FOLDER_NOT_FOUND", "이동할 폴더를 찾을 수 없습니다."));

        if (!"/".equals(targetPath) && fileFolderRepository.findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), targetPath).isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_TARGET_NOT_FOUND", "대상 폴더를 찾을 수 없습니다.");
        }

        String destinationPath = buildFolderPath(targetPath, folderNameFromPath(sourcePath));
        return ApiSuccess.of(relocateFolderTree(projectId, principal.getTenantId(), principal.getUserId(), sourcePath, destinationPath));
    }

    @PostMapping("/api/projects/{projectId}/file-folders/delete")
    public ApiSuccess<Map<String, Object>> deleteFolder(@PathVariable UUID projectId, @RequestBody @Valid DeleteFolderRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER));

        String folderPath = normalizeFolderPath(request.path());
        if ("/".equals(folderPath)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_DELETE_FORBIDDEN", "루트 폴더는 삭제할 수 없습니다.");
        }
        fileFolderRepository.findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, principal.getTenantId(), folderPath)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FOLDER_NOT_FOUND", "삭제할 폴더를 찾을 수 없습니다."));

        List<FileFolderEntity> allFolders = fileFolderRepository.findByProjectIdAndTenantIdAndDeletedAtIsNullOrderByPathAsc(projectId, principal.getTenantId());
        Set<String> deletingPaths = new HashSet<>();
        for (FileFolderEntity folder : allFolders) {
            if (folder.getPath().equals(folderPath) || folder.getPath().startsWith(folderPath + "/")) {
                deletingPaths.add(folder.getPath());
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        List<FileFolderEntity> deletingFolders = new ArrayList<>();
        for (FileFolderEntity folder : allFolders) {
            if (!deletingPaths.contains(folder.getPath())) {
                continue;
            }
            folder.setDeletedAt(now);
            folder.setUpdatedBy(principal.getUserId());
            deletingFolders.add(folder);
        }
        if (!deletingFolders.isEmpty()) {
            fileFolderRepository.saveAll(deletingFolders);
        }

        List<FileEntity> projectFiles = fileRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, principal.getTenantId());
        List<FileEntity> deletingFiles = new ArrayList<>();
        for (FileEntity file : projectFiles) {
            String normalized = normalizeFolderPath(file.getFolder());
            if (normalized.equals(folderPath) || normalized.startsWith(folderPath + "/")) {
                file.setDeletedAt(now);
                file.setUpdatedBy(principal.getUserId());
                deletingFiles.add(file);
            }
        }
        if (!deletingFiles.isEmpty()) {
            fileRepository.saveAll(deletingFiles);
        }

        return ApiSuccess.of(Map.of(
                "deletedFolders", deletingFolders.size(),
                "deletedFiles", deletingFiles.size(),
                "path", folderPath
        ));
    }

    @PostMapping("/api/projects/{projectId}/files")
    public ApiSuccess<FileEntity> create(@PathVariable UUID projectId, @RequestBody @Valid CreateFileRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        ProjectMemberEntity member = guardService.requireProjectMemberRole(projectId, principal.getUserId(), principal.getTenantId(),
                Set.of(MemberRole.PM_OWNER, MemberRole.PM_MEMBER, MemberRole.CLIENT_OWNER, MemberRole.CLIENT_MEMBER));
        VisibilityScope visibilityScope = resolveVisibilityScope(request.visibilityScope());
        if (isClientRole(member.getRole()) && visibilityScope == VisibilityScope.INTERNAL) {
            throw new AppException(HttpStatus.FORBIDDEN, "FILE_VISIBILITY_FORBIDDEN", "?대씪?댁뼵?몃뒗 ?대????뚯씪???앹꽦?????놁뒿?덈떎.");
        }
        FileEntity file = new FileEntity();
        file.setTenantId(principal.getTenantId());
        file.setProjectId(projectId);
        file.setName(request.name());
        file.setDescription(request.description());
        String normalizedFolder = normalizeFolderPath(request.folder());
        upsertFolderPathHierarchy(projectId, principal.getTenantId(), normalizedFolder, principal.getUserId());
        file.setFolder(normalizedFolder);
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
            String normalizedFolder = normalizeFolderPath(request.folder());
            upsertFolderPathHierarchy(file.getProjectId(), principal.getTenantId(), normalizedFolder, principal.getUserId());
            file.setFolder(normalizedFolder);
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "?뚯씪 踰꾩쟾??李얠쓣 ???놁뒿?덈떎."));
        if (version.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "?뚯씪 踰꾩쟾??李얠쓣 ???놁뒿?덈떎.");
        }
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(Map.of("downloadUrl", storageService.createDownloadPresign(version.getObjectKey())));
    }

    @PostMapping("/api/file-versions/{fileVersionId}/comments")
    public ApiSuccess<FileCommentEntity> comment(@PathVariable UUID fileVersionId, @RequestBody @Valid CreateCommentRequest request) {
        var principal = SecurityUtils.requirePrincipal();
        FileVersionEntity version = fileVersionRepository.findById(fileVersionId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "?뚯씪 踰꾩쟾??李얠쓣 ???놁뒿?덈떎."));
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "?뚯씪 踰꾩쟾??李얠쓣 ???놁뒿?덈떎."));
        FileEntity file = requireActiveFile(version.getFileId());
        requireVisibleFileMember(file, principal.getUserId(), principal.getTenantId());
        return ApiSuccess.of(fileCommentRepository.findByFileVersionIdAndTenantIdAndDeletedAtIsNull(fileVersionId, principal.getTenantId()));
    }

    @PatchMapping("/api/file-comments/{commentId}/resolve")
    public ApiSuccess<FileCommentEntity> resolve(@PathVariable UUID commentId) {
        var principal = SecurityUtils.requirePrincipal();
        FileCommentEntity comment = fileCommentRepository.findById(commentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_COMMENT_NOT_FOUND", "?뚯씪 肄붾찘?몃? 李얠쓣 ???놁뒿?덈떎."));
        if (comment.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_COMMENT_NOT_FOUND", "?뚯씪 肄붾찘?몃? 李얠쓣 ???놁뒿?덈떎.");
        }
        FileVersionEntity version = fileVersionRepository.findById(comment.getFileVersionId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_VERSION_NOT_FOUND", "?뚯씪 踰꾩쟾??李얠쓣 ???놁뒿?덈떎."));
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
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "?뚯씪??李얠쓣 ???놁뒿?덈떎."));
        if (file.getDeletedAt() != null) {
            throw new AppException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "?뚯씪??李얠쓣 ???놁뒿?덈떎.");
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
            throw new AppException(HttpStatus.FORBIDDEN, "FILE_NOT_VISIBLE", "?대씪?댁뼵?몄뿉寃?鍮꾧났媛??뚯씪?낅땲??");
        }
    }

    private boolean isClientRole(MemberRole role) {
        return role == MemberRole.CLIENT_OWNER || role == MemberRole.CLIENT_MEMBER;
    }

    private VisibilityScope resolveVisibilityScope(VisibilityScope scope) {
        return scope == null ? VisibilityScope.SHARED : scope;
    }

    private void upsertFolderPathHierarchy(UUID projectId, UUID tenantId, String folderPath, UUID actorUserId) {
        if ("/".equals(folderPath)) {
            return;
        }
        String[] parts = folderPath.substring(1).split("/");
        String current = "";
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            current = current + "/" + part;
            boolean exists = fileFolderRepository.existsByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(projectId, tenantId, current);
            if (!exists) {
                FileFolderEntity folder = new FileFolderEntity();
                folder.setTenantId(tenantId);
                folder.setProjectId(projectId);
                folder.setPath(current);
                folder.setCreatedBy(actorUserId);
                folder.setUpdatedBy(actorUserId);
                fileFolderRepository.save(folder);
            }
        }
    }

    private Map<String, Object> relocateFolderTree(UUID projectId, UUID tenantId, UUID actorUserId, String sourcePath, String destinationPath) {
        if (destinationPath.equals(sourcePath)) {
            return Map.of(
                    "movedFolders", 0,
                    "movedFiles", 0,
                    "destinationPath", destinationPath
            );
        }
        if (destinationPath.startsWith(sourcePath + "/")) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_MOVE_INVALID", "하위 폴더로는 이동할 수 없습니다.");
        }

        List<FileFolderEntity> allFolders = fileFolderRepository.findByProjectIdAndTenantIdAndDeletedAtIsNullOrderByPathAsc(projectId, tenantId);
        Set<String> movingPaths = new HashSet<>();
        for (FileFolderEntity folder : allFolders) {
            if (folder.getPath().equals(sourcePath) || folder.getPath().startsWith(sourcePath + "/")) {
                movingPaths.add(folder.getPath());
            }
        }

        Set<String> occupiedPaths = new HashSet<>();
        for (FileFolderEntity folder : allFolders) {
            if (!movingPaths.contains(folder.getPath())) {
                occupiedPaths.add(folder.getPath());
            }
        }

        Map<String, String> pathReplacements = new HashMap<>();
        for (String movingPath : movingPaths) {
            String nextPath = destinationPath + movingPath.substring(sourcePath.length());
            if (occupiedPaths.contains(nextPath)) {
                throw new AppException(HttpStatus.CONFLICT, "FOLDER_ALREADY_EXISTS", "대상 위치에 동일한 폴더가 존재합니다.");
            }
            pathReplacements.put(movingPath, nextPath);
        }

        List<FileFolderEntity> changedFolders = new ArrayList<>();
        for (FileFolderEntity folder : allFolders) {
            String replaced = pathReplacements.get(folder.getPath());
            if (replaced != null) {
                folder.setPath(replaced);
                folder.setUpdatedBy(actorUserId);
                changedFolders.add(folder);
            }
        }
        if (!changedFolders.isEmpty()) {
            changedFolders.sort(Comparator.comparing(FileFolderEntity::getPath));
            fileFolderRepository.saveAll(changedFolders);
        }

        List<FileEntity> projectFiles = fileRepository.findByProjectIdAndTenantIdAndDeletedAtIsNull(projectId, tenantId);
        int movedFiles = 0;
        for (FileEntity file : projectFiles) {
            String folderPath = normalizeFolderPath(file.getFolder());
            if (folderPath.equals(sourcePath) || folderPath.startsWith(sourcePath + "/")) {
                String nextPath = destinationPath + folderPath.substring(sourcePath.length());
                file.setFolder(nextPath);
                file.setUpdatedBy(actorUserId);
                movedFiles += 1;
            }
        }
        if (movedFiles > 0) {
            fileRepository.saveAll(projectFiles);
        }

        return Map.of(
                "movedFolders", changedFolders.size(),
                "movedFiles", movedFiles,
                "destinationPath", destinationPath
        );
    }

    private String normalizeFolderPath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return "/";
        }
        String path = rawPath.trim().replace("\\", "/");
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        path = path.replaceAll("/+", "/");
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path.isBlank() ? "/" : path;
    }

    private String normalizeFolderName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_NAME_INVALID", "?대뜑 ?대쫫???낅젰??二쇱꽭??");
        }
        if (trimmed.contains("/")) {
            throw new AppException(HttpStatus.BAD_REQUEST, "FOLDER_NAME_INVALID", "?대뜑 ?대쫫?먮뒗 '/'瑜??ъ슜?????놁뒿?덈떎.");
        }
        return trimmed;
    }

    private String folderNameFromPath(String path) {
        if ("/".equals(path)) {
            return "";
        }
        int idx = path.lastIndexOf("/");
        return idx < 0 ? path : path.substring(idx + 1);
    }

    private String parentFolderPath(String path) {
        if ("/".equals(path)) {
            return "/";
        }
        int idx = path.lastIndexOf("/");
        if (idx <= 0) {
            return "/";
        }
        return path.substring(0, idx);
    }

    private String buildFolderPath(String parentPath, String folderName) {
        if ("/".equals(parentPath)) {
            return "/" + folderName;
        }
        return parentPath + "/" + folderName;
    }

    public record CreateFileRequest(@NotBlank String name, String description, String folder, VisibilityScope visibilityScope) {
    }

    public record PatchFileRequest(String name, String description, String folder, VisibilityScope visibilityScope) {
    }

    public record CreateFolderRequest(@NotBlank String name, String parentPath) {
    }

    public record MoveFolderRequest(@NotBlank String sourcePath, String targetPath) {
    }

    public record RenameFolderRequest(@NotBlank String sourcePath, @NotBlank String name) {
    }

    public record DeleteFolderRequest(@NotBlank String path) {
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
