package com.bridge.backend.domain.signing;

import com.bridge.backend.common.model.enums.SignatureFieldType;
import com.bridge.backend.domain.contract.SignatureFieldEntity;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

@Service
public class PdfSigningService {
    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:image/[^;]+;base64,(.+)$", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final PDType1Font DEFAULT_FONT = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private static final PDType1Font SIGNATURE_FONT = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

    public byte[] applyRecipientFields(byte[] sourcePdfBytes,
                                       List<SignatureFieldEntity> recipientFields,
                                       Map<UUID, String> fieldValues,
                                       String signatureDataUrl,
                                       String signerName) {
        if (recipientFields.isEmpty()) {
            return sourcePdfBytes;
        }

        try (PDDocument document = Loader.loadPDF(sourcePdfBytes);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (SignatureFieldEntity field : recipientFields) {
                int pageIndex = Math.max(0, field.getPage() - 1);
                if (pageIndex >= document.getNumberOfPages()) {
                    continue;
                }

                PDPage page = document.getPage(pageIndex);
                Rect rect = resolveRect(page, field);
                if (rect.width() <= 0 || rect.height() <= 0) {
                    continue;
                }

                String value = fieldValues.getOrDefault(field.getId(), "");
                if (field.getType() == SignatureFieldType.DATE && value.isBlank()) {
                    value = DATE_FORMATTER.format(LocalDate.now());
                }

                try (PDPageContentStream stream = new PDPageContentStream(document, page, AppendMode.APPEND, true, true)) {
                    renderField(stream, document, field.getType(), rect, value, signatureDataUrl, signerName);
                }
            }

            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to render signature fields into PDF.", ex);
        }
    }

    private void renderField(PDPageContentStream stream,
                             PDDocument document,
                             SignatureFieldType type,
                             Rect rect,
                             String value,
                             String signatureDataUrl,
                             String signerName) throws IOException {
        if (type == SignatureFieldType.CHECKBOX) {
            drawCheckbox(stream, rect, isTruthy(value));
            return;
        }

        if (type == SignatureFieldType.SIGNATURE || type == SignatureFieldType.INITIAL) {
            if (drawSignatureImage(stream, document, rect, value, signatureDataUrl)) {
                return;
            }
            String fallback = value.isBlank() ? signerName : value;
            drawText(stream, rect, fallback, SIGNATURE_FONT);
            return;
        }

        drawText(stream, rect, value, DEFAULT_FONT);
    }

    private boolean drawSignatureImage(PDPageContentStream stream,
                                       PDDocument document,
                                       Rect rect,
                                       String fieldValue,
                                       String defaultSignatureDataUrl) throws IOException {
        byte[] imageBytes = decodeDataUrl(fieldValue);
        if (imageBytes == null) {
            imageBytes = decodeDataUrl(defaultSignatureDataUrl);
        }
        if (imageBytes == null) {
            return false;
        }

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (image == null) {
            return false;
        }
        PDImageXObject xObject = LosslessFactory.createFromImage(document, image);
        stream.drawImage(xObject, rect.x(), rect.y(), rect.width(), rect.height());
        return true;
    }

    private void drawText(PDPageContentStream stream, Rect rect, String value, PDType1Font font) throws IOException {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) {
            return;
        }
        float fontSize = Math.max(8f, Math.min(16f, rect.height() * 0.6f));
        float baselineY = rect.y() + Math.max(1f, (rect.height() - fontSize) / 2f);

        stream.beginText();
        stream.setFont(font, fontSize);
        stream.newLineAtOffset(rect.x() + 2f, baselineY);
        stream.showText(text);
        stream.endText();
    }

    private void drawCheckbox(PDPageContentStream stream, Rect rect, boolean checked) throws IOException {
        stream.addRect(rect.x(), rect.y(), rect.width(), rect.height());
        stream.stroke();
        if (!checked) {
            return;
        }

        stream.moveTo(rect.x() + 2f, rect.y() + 2f);
        stream.lineTo(rect.x() + rect.width() - 2f, rect.y() + rect.height() - 2f);
        stream.moveTo(rect.x() + 2f, rect.y() + rect.height() - 2f);
        stream.lineTo(rect.x() + rect.width() - 2f, rect.y() + 2f);
        stream.stroke();
    }

    private Rect resolveRect(PDPage page, SignatureFieldEntity field) {
        float pageWidth = page.getMediaBox().getWidth();
        float pageHeight = page.getMediaBox().getHeight();

        boolean normalized = isNormalized(field);
        float width = normalized ? (float) (field.getCoordW() * pageWidth) : (float) field.getCoordW();
        float height = normalized ? (float) (field.getCoordH() * pageHeight) : (float) field.getCoordH();
        float x = normalized ? (float) (field.getCoordX() * pageWidth) : (float) field.getCoordX();
        float topY = normalized ? (float) (field.getCoordY() * pageHeight) : (float) field.getCoordY();
        float y = pageHeight - topY - height;

        float clampedX = Math.max(0f, Math.min(x, pageWidth));
        float clampedY = Math.max(0f, Math.min(y, pageHeight));
        float clampedW = Math.max(0f, Math.min(width, pageWidth - clampedX));
        float clampedH = Math.max(0f, Math.min(height, pageHeight - clampedY));
        return new Rect(clampedX, clampedY, clampedW, clampedH);
    }

    private boolean isNormalized(SignatureFieldEntity field) {
        return field.getCoordX() >= 0 && field.getCoordX() <= 1
                && field.getCoordY() >= 0 && field.getCoordY() <= 1
                && field.getCoordW() >= 0 && field.getCoordW() <= 1
                && field.getCoordH() >= 0 && field.getCoordH() <= 1;
    }

    private byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            return null;
        }
        Matcher matcher = DATA_URL_PATTERN.matcher(dataUrl.trim());
        if (!matcher.matches()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(matcher.group(1));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private boolean isTruthy(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim().toLowerCase();
        return normalized.equals("true")
                || normalized.equals("1")
                || normalized.equals("yes")
                || normalized.equals("y")
                || normalized.equals("on");
    }

    private record Rect(float x, float y, float width, float height) {
    }
}
