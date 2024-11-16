document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const controls = document.getElementById('controls');
    const originalPreview = document.getElementById('originalPreview');
    const compressedPreview = document.getElementById('compressedPreview');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const downloadBtn = document.getElementById('downloadBtn');
    const sizeScale = document.getElementById('sizeScale');
    const scaleValue = document.getElementById('scaleValue');
    const batchList = document.getElementById('batchList');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const prevImage = document.getElementById('prevImage');
    const nextImage = document.getElementById('nextImage');
    const imageCounter = document.getElementById('imageCounter');
    const fullscreenPreview = document.getElementById('fullscreenPreview');
    const fullscreenImage = document.getElementById('fullscreenImage');
    const previewImages = document.querySelectorAll('.preview-image');
    const formatSelect = document.getElementById('format');
    const namePattern = document.getElementById('namePattern');
    const customPattern = document.getElementById('customPattern');
    const startNumber = document.getElementById('startNumber');
    const namePreview = document.querySelector('.name-preview');

    let originalImage = null;
    let aspectRatio = 1;
    let batchFiles = [];
    let currentImageType = '';
    let currentImageIndex = 0;
    let compressionResults = new Map(); // 用于存储每个文件的压缩结果

    // 处理拖放上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#00cc66';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#0066cc';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#0066cc';
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // 处理点击上传
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
            handleFiles(files);
        }
        // 清空 input 值，确保可以重复选择同一文件
        fileInput.value = '';
    });

    // 新的文件处理函数
    function handleFiles(files) {
        // 将新文件追加到现有文件列表中
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (newFiles.length === 0) return;
        
        // 检查是否有重复文件
        const existingFileNames = new Set(batchFiles.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(file => !existingFileNames.has(file.name));
        
        // 追加新文件
        batchFiles = [...batchFiles, ...uniqueNewFiles];
        
        // 显示控制区域
        controls.style.display = 'block';
        
        // 如果这是第一次添加文件
        if (batchFiles.length === uniqueNewFiles.length) {
            currentImageIndex = 0;
            handleImage(batchFiles[0]);
        }
        
        // 更新UI显示
        if (batchFiles.length > 1) {
            downloadAllBtn.style.display = 'block';
            downloadBtn.style.display = 'none';
            updateDownloadButtonText(batchFiles.length);
            updateNavigationButtons();
        } else {
            downloadAllBtn.style.display = 'none';
            downloadBtn.style.display = 'block';
            hideNavigationButtons();
        }
        
        // 更新批量列表
        updateBatchList();
        
        // 显示提示信息
        if (uniqueNewFiles.length > 0) {
            showToast(`已添加 ${uniqueNewFiles.length} 个新文件`);
        }
        
        // 清理已移除文件的压缩结果
        const newFileNames = new Set(batchFiles.map(f => f.name));
        for (const fileName of compressionResults.keys()) {
            if (!newFileNames.has(fileName)) {
                compressionResults.delete(fileName);
            }
        }
        
        // 更新总体积统计
        updateBatchStats();
    }

    // 添加提示信息显示函数
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 动画显示
        setTimeout(() => toast.classList.add('show'), 10);
        
        // 3秒后消失
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 处理图片压缩
    function handleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = new Image();
            originalImage.src = e.target.result;
            originalImage.onload = () => {
                // 显示原图
                originalPreview.src = originalImage.src;
                originalSize.textContent = `原始大小: ${(file.size / 1024).toFixed(2)} KB`;
                
                // 设置初始尺寸值
                aspectRatio = originalImage.width / originalImage.height;
                sizeScale.value = '100';
                scaleValue.textContent = '100%';
                
                // 压缩图片
                compressImage();
            };
        };
        reader.readAsDataURL(file);
    }

    // 添加缩放比例滑块事件监听
    sizeScale.addEventListener('input', (e) => {
        scaleValue.textContent = `${e.target.value}%`;
        
        // 立即更新当前预览的图片
        if (originalImage) {
            compressImage();
        }
        
        // 延迟更新批量列表中的其他图片
        debouncedUpdateAll();
    });

    // 修改压缩图片函数中的尺寸计算部分
    async function compressImage() {
        if (!originalImage) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 使用缩放比例计算新尺寸
        const scale = parseInt(sizeScale.value) / 100;
        canvas.width = Math.round(originalImage.width * scale);
        canvas.height = Math.round(originalImage.height * scale);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        
        // 使用选择的格式和质量
        const quality = qualitySlider.value / 100;
        const format = `image/${formatSelect.value}`;
        const compressedDataUrl = canvas.toDataURL(format, quality);
        
        compressedPreview.src = compressedDataUrl;
        
        // 更新尺寸信息显示
        const originalDimensions = `${originalImage.width} × ${originalImage.height}`;
        const newDimensions = `${canvas.width} × ${canvas.height}`;
        
        // 计算压缩后的大小
        const compressedSize = Math.round((compressedDataUrl.length * 3) / 4);
        document.getElementById('compressedSize').textContent = 
            `压缩后大小: ${(compressedSize / 1024).toFixed(2)} KB`;
    }

    // 计算最佳输出尺寸
    function calculateOptimalDimensions(img) {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        
        let width = img.width;
        let height = img.height;
        
        // 如果图片太大，按比例缩小
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        // 确保尺寸是偶数（有助于某些压缩算法）
        width = width - (width % 2);
        height = height - (height % 2);
        
        return { width, height };
    }

    // 检测WebP支持
    function supportWebP() {
        const canvas = document.createElement('canvas');
        if (!!(canvas.getContext && canvas.getContext('2d'))) {
            return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        }
        return false;
    }

    // 质量滑块事件
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
        
        // 更新当前预览的图片
        if (originalImage) {
            compressImage();
        }
        
        // 重新计算所有图片的压缩结果
        if (batchFiles.length > 0) {
            updateAllCompressionResults();
        }
    });

    // 添加批量更新压缩结果的函数
    async function updateAllCompressionResults() {
        // 清空之前的压缩结果
        compressionResults.clear();
        
        // 为每个文件重新计算压缩结果
        const updatePromises = batchFiles.map((file, index) => 
            calculateCompressedSize(file, index)
        );
        
        // 等待所有新完成
        await Promise.all(updatePromises);
        
        // 更新总体积统计
        updateBatchStats();
    }

    // 修改 calculateCompressedSize 函数中的信息显示部分
    async function calculateCompressedSize(file, index) {
        const compressionInfoElement = document.getElementById(`compressed-size-${index}`);
        compressionInfoElement.innerHTML = '<div class="loading-text">处理中...</div>';
        
        try {
            const result = await compressFile(file, index);
            const originalSize = file.size;
            const compressedSize = result.blob.size;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            
            // 存储压缩结果
            compressionResults.set(file.name, {
                originalSize,
                compressedSize,
                compressionRatio,
                dimensions: {
                    original: `${result.originalWidth} × ${result.originalHeight}`,
                    compressed: `${result.newWidth} × ${result.newHeight}`
                }
            });
            
            // 更新UI显示，移除重复的原始大小显示
            compressionInfoElement.innerHTML = `
                <div class="compression-info-group">
                    <div class="size-info">
                        体积：${(originalSize / 1024).toFixed(2)} KB → ${(compressedSize / 1024).toFixed(2)} KB
                    </div>
                    <div class="dimension-info">
                        尺寸：${result.originalWidth} × ${result.originalHeight} → ${result.newWidth} × ${result.newHeight}
                    </div>
                    <div class="ratio ${compressionRatio > 0 ? 'positive' : 'negative'}">
                        ↓ ${Math.abs(compressionRatio)}%
                    </div>
                </div>
            `;
            
            // 更新总体积统计
            updateBatchStats();
            
        } catch (error) {
            console.error('计算压缩大小时出错:', error);
            compressionInfoElement.innerHTML = '<div class="error">计算失败</div>';
        }
    }

    // 添加防抖函数，避免频繁更新
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 使用防抖优化滑块事件处理
    const debouncedUpdateAll = debounce(() => {
        if (batchFiles.length > 0) {
            updateAllCompressionResults();
        }
    }, 300);

    // 修改质量滑块事件，使用防抖
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
        
        // 立即更新当前预览的图片
        if (originalImage) {
            compressImage();
        }
        
        // 延迟更新批量列表中的其他图片
        debouncedUpdateAll();
    });

    // 下载按钮事件
    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const format = formatSelect.value;
        link.download = formatFileName(batchFiles[currentImageIndex].name, currentImageIndex);
        link.href = compressedPreview.src;
        link.click();
    });

    // 更新批量文件列表
    function updateBatchList() {
        batchList.innerHTML = '';
        batchFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'batch-item';
            
            // 创建左侧预览区
            const previewSection = document.createElement('div');
            previewSection.className = 'batch-item-preview';
            
            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            img.onload = () => URL.revokeObjectURL(objectUrl);
            
            const info = document.createElement('div');
            info.className = 'batch-item-info';
            info.textContent = file.name;
            
            previewSection.appendChild(img);
            previewSection.appendChild(info);
            
            // 创建右侧压缩信息区，移除原始大小显示
            const compressionInfo = document.createElement('div');
            compressionInfo.className = 'compression-info';
            compressionInfo.innerHTML = `
                <div class="compressed-size" id="compressed-size-${index}">
                    <div class="loading-text">处理中...</div>
                </div>
            `;
            
            item.appendChild(previewSection);
            item.appendChild(compressionInfo);
            batchList.appendChild(item);
            
            // 点击切换预览
            item.addEventListener('click', () => {
                currentImageIndex = index;
                updatePreview();
            });
            
            // 立即计算压缩后的大小
            calculateCompressedSize(file, index);
        });
    }

    // 添加总体积统计函数
    function updateBatchStats() {
        const batchStats = document.getElementById('batchStats');
        if (!batchStats || compressionResults.size === 0) return;
        
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;
        
        // 计算总体
        compressionResults.forEach(result => {
            totalOriginalSize += result.originalSize;
            totalCompressedSize += result.compressedSize;
        });
        
        // 计算总压缩比
        const totalRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1);
        const isPositive = totalRatio > 0;
        
        // 更新统计信息显示
        batchStats.innerHTML = `
            <div class="total-size">
                总体积：${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB → 
                ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB
            </div>
            <div class="total-ratio ${isPositive ? 'positive' : 'negative'}">
                ${isPositive ? '↓' : '↑'} ${Math.abs(totalRatio)}%
            </div>
        `;
    }

    // 修改图像处理函数，添加新的处理选项
    async function processImage(canvas, ctx) {
        // 应用锐化
        if (sharpenSlider.value > 0) {
            applySharpen(ctx, canvas.width, canvas.height, sharpenSlider.value / 100);
        }
        
        // 应用降噪
        if (noiseSlider.value > 0) {
            applyNoise(ctx, canvas.width, canvas.height, noiseSlider.value / 100);
        }
        
        // 智能压缩模式
        if (compressionMode.value === 'auto') {
            return await autoCompress(canvas, currentImageType);
        }
        
        // 手动压缩模式
        return await manualCompress(canvas);
    }

    // 锐化处理
    function applySharpen(ctx, width, height, strength) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const factor = strength * 50;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const leftIdx = (y * width + Math.max(x - 1, 0)) * 4;
                const rightIdx = (y * width + Math.min(x + 1, width - 1)) * 4;
                const upIdx = (Math.max(y - 1, 0) * width + x) * 4;
                const downIdx = (Math.min(y + 1, height - 1) * width + x) * 4;
                
                for (let i = 0; i < 3; i++) {
                    const current = data[idx + i];
                    const neighbors = (
                        data[leftIdx + i] +
                        data[rightIdx + i] +
                        data[upIdx + i] +
                        data[downIdx + i]
                    ) / 4;
                    
                    data[idx + i] = Math.min(255, Math.max(0,
                        current + (current - neighbors) * factor
                    ));
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    // 降噪处理
    function applyNoise(ctx, width, height, strength) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const radius = Math.ceil(strength * 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                let r = 0, g = 0, b = 0, count = 0;
                
                // 计算周围像素的平均值
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const nIdx = (ny * width + nx) * 4;
                            r += data[nIdx];
                            g += data[nIdx + 1];
                            b += data[nIdx + 2];
                            count++;
                        }
                    }
                }
                
                // 应用平均值
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    // 智能压缩
    async function autoCompress(canvas, imageType) {
        // 根据图片类型选最佳参
        let format = 'image/jpeg';
        let quality = 0.8;
        
        if (imageType.includes('text') || imageType.includes('line')) {
            // 文字或线条图像
            format = 'image/png';
            quality = 0.9;
        } else if (imageType.includes('photo')) {
            // 照片
            if (supportWebP()) {
                format = 'image/webp';
                quality = 0.75;
            }
        }
        
        return canvas.toDataURL(format, quality);
    }

    // 手动压缩
    async function manualCompress(canvas) {
        const format = outputFormat.value === 'auto' ? 
            detectBestFormat() : 
            `image/${outputFormat.value}`;
        
        const quality = qualitySlider.value / 100;
        return canvas.toDataURL(format, quality);
    }

    // 检测最佳输出格式
    function detectBestFormat() {
        if (currentImageType.includes('text') || currentImageType.includes('line')) {
            return 'image/png';
        }
        if (supportWebP()) {
            return 'image/webp';
        }
        return 'image/jpeg';
    }

    // 修改 compressFile 函数
    async function compressFile(file, index) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const scale = parseInt(sizeScale.value) / 100;
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const quality = qualitySlider.value / 100;
                    const format = `image/${formatSelect.value}`;
                    
                    canvas.toBlob((blob) => {
                        resolve({
                            blob,
                            originalWidth: img.width,
                            originalHeight: img.height,
                            newWidth: canvas.width,
                            newHeight: canvas.height,
                            fileName: formatFileName(file.name, index)
                        });
                    }, format, quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // 添加文件名格式化函数
    function formatFileName(originalName, index) {
        const format = formatSelect.value;
        const pattern = namePattern.value;
        const custom = customPattern.value;
        const startIdx = parseInt(startNumber.value);
        const number = startIdx + index;
        
        if (pattern === 'name_suffix') {
            return `${custom}${number}.${format}`;
        } else {
            return `${number}${custom}.${format}`;
        }
    }

    // 修改批量下载函数
    downloadAllBtn.addEventListener('click', async () => {
        const totalCount = batchFiles.length;
        downloadAllBtn.textContent = '压缩中...';
        downloadAllBtn.disabled = true;

        try {
            // 计算总压缩后大小
            let totalCompressedSize = 0;
            compressionResults.forEach(result => {
                totalCompressedSize += result.compressedSize;
            });

            // 格式化日期时间
            const now = new Date();
            const dateTimeStr = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\s/g, '_');  // 用下划线替换空格

            // 格式化文件大小
            const sizeStr = totalCompressedSize > 1024 * 1024 
                ? `${(totalCompressedSize / (1024 * 1024)).toFixed(1)}MB`
                : `${(totalCompressedSize / 1024).toFixed(1)}KB`;

            // 生成文件夹名和压缩包名（保持一致）
            const folderName = `压缩后的${totalCount}张图片_${sizeStr}_${dateTimeStr}`;
            
            const zip = new JSZip();
            const folder = zip.folder(folderName);  // 使用相同的名称
            
            // 为每个文件创建一个压缩任务
            const compressionTasks = batchFiles.map(async (file, index) => {
                try {
                    const result = await compressFile(file, index);
                    // 使用格式化后的文件名
                    return {
                        name: result.fileName,
                        data: await result.blob.arrayBuffer()
                    };
                } catch (err) {
                    console.error(`处理文件 ${file.name} 时出错:`, err);
                    return null;
                }
            });

            // 等待所有压缩任务完成
            const results = await Promise.all(compressionTasks);
            
            // 将成功压缩的文件添加到zip中
            results.forEach(result => {
                if (result) {
                    folder.file(result.name, result.data);
                }
            });

            // 生成并下载zip文件
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${folderName}.zip`;  // 使用相同的名称加.zip后缀
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error('压缩过程出错:', error);
            alert('压缩过程中出现错误，请重试');
        } finally {
            updateDownloadButtonText(totalCount);
            downloadAllBtn.disabled = false;
        }
    });

    // 修改导航按钮更新函数
    function updateNavigationButtons() {
        if (batchFiles.length <= 1) {
            hideNavigationButtons();
            return;
        }

        prevImage.style.display = 'block';
        nextImage.style.display = 'block';
        imageCounter.style.display = 'block';
        
        prevImage.disabled = currentImageIndex === 0;
        nextImage.disabled = currentImageIndex === batchFiles.length - 1;
        
        // 更新页码显示
        imageCounter.textContent = `${currentImageIndex + 1}/${batchFiles.length}`;
    }

    // 修改预览更新函数
    function updatePreview() {
        handleImage(batchFiles[currentImageIndex]);
        updateNavigationButtons();
        
        // 更新批量列表中的选中状态
        document.querySelectorAll('.batch-item').forEach((item, index) => {
            item.classList.toggle('selected', index === currentImageIndex);
            // 确保选中项可见
            if (index === currentImageIndex) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // 修改导航按钮点击事件
    prevImage.addEventListener('click', () => {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updatePreview();
        }
    });

    nextImage.addEventListener('click', () => {
        if (currentImageIndex < batchFiles.length - 1) {
            currentImageIndex++;
            updatePreview();
        }
    });

    // 添加导航按钮更新函数
    function updateNavigationButtons() {
        prevImage.style.display = 'block';
        nextImage.style.display = 'block';
        imageCounter.style.display = 'block';
        
        prevImage.disabled = currentImageIndex === 0;
        nextImage.disabled = currentImageIndex === batchFiles.length - 1;
        imageCounter.textContent = `${currentImageIndex + 1}/${batchFiles.length}`;
    }

    function hideNavigationButtons() {
        prevImage.style.display = 'none';
        nextImage.style.display = 'none';
        imageCounter.style.display = 'none';
    }

    // 添加预览更新函数
    function updatePreview() {
        handleImage(batchFiles[currentImageIndex]);
        updateNavigationButtons();
        
        // 更新批量列表中的选中状态
        document.querySelectorAll('.batch-item').forEach((item, index) => {
            item.classList.toggle('selected', index === currentImageIndex);
        });
    }

    // 添加键盘导航支持
    document.addEventListener('keydown', (e) => {
        if (!batchFiles.length || batchFiles.length === 1) return;
        
        if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
            currentImageIndex--;
            updatePreview();
        } else if (e.key === 'ArrowRight' && currentImageIndex < batchFiles.length - 1) {
            currentImageIndex++;
            updatePreview();
        }
    });

    // 添加全屏预览相关事件监听
    previewImages.forEach(img => {
        img.addEventListener('click', () => {
            openFullscreenPreview(img.src);
        });
    });

    fullscreenPreview.querySelector('.close-btn').addEventListener('click', closeFullscreenPreview);

    // 全屏预览时的键盘导航
    document.addEventListener('keydown', (e) => {
        if (fullscreenPreview.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeFullscreenPreview();
            } else if (e.key === 'ArrowLeft') {
                navigateFullscreen('prev');
            } else if (e.key === 'ArrowRight') {
                navigateFullscreen('next');
            }
        }
    });

    // 全屏预览的导航按钮
    fullscreenPreview.querySelector('.nav-btn.prev').addEventListener('click', () => {
        navigateFullscreen('prev');
    });

    fullscreenPreview.querySelector('.nav-btn.next').addEventListener('click', () => {
        navigateFullscreen('next');
    });

    // 打开全屏预览
    function openFullscreenPreview(imageSrc) {
        fullscreenImage.src = imageSrc;
        fullscreenPreview.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    // 关闭全屏预览
    function closeFullscreenPreview() {
        fullscreenPreview.classList.remove('active');
        document.body.style.overflow = '';
    }

    // 全屏预览时的导航
    function navigateFullscreen(direction) {
        if (!batchFiles.length || batchFiles.length === 1) return;
        
        if (direction === 'prev' && currentImageIndex > 0) {
            currentImageIndex--;
        } else if (direction === 'next' && currentImageIndex < batchFiles.length - 1) {
            currentImageIndex++;
        }
        
        updatePreview();
        // 更新全屏预览的图片
        const currentPreviewImage = fullscreenImage.src.includes('compressed') ? 
            compressedPreview.src : originalPreview.src;
        fullscreenImage.src = currentPreviewImage;
    }

    // 在页面加载时检查WebP支持
    if (!supportWebP()) {
        // 如果不支持WebP，移除WebP选项
        const webpOption = formatSelect.querySelector('option[value="webp"]');
        if (webpOption) {
            webpOption.remove();
        }
    }

    // 添加格式选择的事件监听
    formatSelect.addEventListener('change', () => {
        // 更新当前预览的图片
        if (originalImage) {
            compressImage();
        }
        
        // 重新计算所有图片的压缩结果
        if (batchFiles.length > 0) {
            debouncedUpdateAll();
        }
    });

    // 添加更新下载按钮文案的函数
    function updateDownloadButtonText(count) {
        downloadAllBtn.textContent = `下载压缩后的${count}张图片`;
    }

    // 更新文件名预览
    function updateNamePreview() {
        const format = formatSelect.value;
        const pattern = namePattern.value;
        const custom = customPattern.value;
        const number = parseInt(startNumber.value);
        
        let previewName;
        if (pattern === 'name_suffix') {
            previewName = `${custom}${number}.${format}`;
        } else {
            previewName = `${number}${custom}.${format}`;
        }
        
        namePreview.textContent = `示例：${previewName}`;
    }

    // 添加事件监听
    namePattern.addEventListener('change', updateNamePreview);
    customPattern.addEventListener('input', updateNamePreview);
    startNumber.addEventListener('input', updateNamePreview);
    formatSelect.addEventListener('change', updateNamePreview);
}); 