document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // 获取DOM元素
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const imagePreview = document.getElementById('imagePreview');
    const emailInput = document.getElementById('email');
    const descriptionInput = document.getElementById('description');
    const startProcessBtn = document.getElementById('startProcessBtn');
    const feedbackArea = document.getElementById('feedbackArea');
    const form = document.querySelector('form');
    
    // 验证关键元素存在
    if (!fileInput || !uploadArea || !imagePreview) {
        console.error('关键元素未找到:', {
            fileInput: !!fileInput,
            uploadArea: !!uploadArea,
            imagePreview: !!imagePreview
        });
        return;
    }

    const MAX_FILES = 3;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    // Supabase配置 - 从环境变量获取
    const supabase = supabase.createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // 初始化Storage Bucket
    const BUCKET_NAME = 'payment-receipts';

    let uploadedFiles = [];

    // 初始化上传区域
    const initUpload = () => {
        try {
            console.log('Upload elements initialized');
            
            // 设置可点击样式
            uploadArea.style.cursor = 'pointer';
            uploadArea.style.pointerEvents = 'auto';

            // 绑定点击事件
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
        } catch (error) {
            console.error('Upload init error:', error);
        }
    };

    // 初始化上传功能
    initUpload();
    initEmailTestButton(); // 初始化测试邮件按钮

    // 文件选择处理
    fileInput.addEventListener('change', (event) => {
        imagePreview.innerHTML = '';
        uploadedFiles = [];
        const files = Array.from(event.target.files);

        if (files.length > MAX_FILES) {
            displayFeedback(`SYSTEM OVERLOAD: Upload limit exceeded. Max ${MAX_FILES} files.`, 'error');
            fileInput.value = '';
            return;
        }

        files.forEach(file => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                displayFeedback(`PROTOCOL ERROR: Invalid file type. ${file.name} is not recognized. Use JPEG, PNG, GIF, or WebP.`, 'error');
                return;
            }
            if (files.length <= MAX_FILES) {
                uploadedFiles.push(file);
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = e.target.result;
                    imgElement.alt = file.name;
                    imgElement.className = 'w-full h-32 object-cover rounded-md border border-slate-700';
                    imagePreview.appendChild(imgElement);
                };
                reader.readAsDataURL(file);
            }
        });
        
        if(uploadedFiles.length > 0 && uploadedFiles.length <= MAX_FILES) {
            displayFeedback('DATA INTERFACE ESTABLISHED: Files received, pending validation.', 'success');
        } else if (files.length > 0 && uploadedFiles.length === 0) {
            fileInput.value = ''; 
        }
    });

    // 处理按钮点击

    startProcessBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // 额外确保阻止默认行为
        clearFeedback();

        if (uploadedFiles.length === 0) {
            displayFeedback('PROTOCOL ERROR: No data uplink. Please upload at least one image file.', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const emailRegex = new RegExp('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
        if (!emailRegex.test(email)) {
            displayFeedback('SECURITY PROTOCOL VIOLATION: Invalid email format detected.', 'error');
            return;
        }

        const description = descriptionInput.value.trim();
        
        // 直接跳转支付页面
        displayFeedback('PROCESSING: Initiating payment protocol...', 'info');
        
        // 构建支付页面URL参数
        const paymentParams = new URLSearchParams();
        paymentParams.append('email', email);
        paymentParams.append('desc', description);
        uploadedFiles.forEach((file, index) => {
            paymentParams.append(`file${index}`, file.name);
        });
        
        // 跳转到支付页面
        window.location.href = `payment.html?${paymentParams.toString()}`;

        setLoadingState(true, 'Authenticating Protocol...');
        await simulateDelay(2000); 
        displayFeedback('AUTHENTICATION SUCCESSFUL: Protocol confirmed. Preparing synthesis task...', 'success', false);
        
        let mechaCodename = "N/A";
        let systemLog = "Standard synthesis protocol initiated.";

        if (description) {
            setLoadingState(true, 'Generating Mech Specifications...');
            try {
                const llmResponse = await fetchLLMSpecifications(description);
                if (llmResponse.codename) mechaCodename = llmResponse.codename;
                if (llmResponse.log_excerpt) systemLog = llmResponse.log_excerpt;
                
                const codenameDiv = document.createElement('div');
                codenameDiv.className = 'text-center mt-2';
                codenameDiv.innerHTML = `<p class="text-slate-400">Mech Codename: <strong class="text-yellow-400">${mechaCodename}</strong></p><p class="text-xs text-slate-500">System Log Excerpt: <em>${systemLog}</em></p>`;
                feedbackArea.appendChild(codenameDiv);
                
            } catch (error) {
                console.error("LLM API Error:", error);
                displayFeedback('LLM COMMS FAILURE: Cannot generate mech specs. Using default parameters.', 'error', true);
                await simulateDelay(1000);
            }
        }
        
        // 上传文件到Supabase Storage
        setLoadingState(true, 'UPLOADING TO CLOUD STORAGE...');
        
        try {
            const fileUrls = [];
            for (const file of uploadedFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(`receipts/${fileName}`, file);
                
                if (error) throw error;
                
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(`receipts/${fileName}`);
                
                fileUrls.push(publicUrl);
            }

            // 保存数据到Supabase表
            const { error: dbError } = await supabase
                .from('payments')
                .insert({
                    email,
                    description,
                    mech_codename: mechaCodename,
                    system_log: systemLog,
                    file_urls: fileUrls,
                    created_at: new Date()
                });
            
            if (dbError) throw dbError;
            
            displayFeedback(`TASK COMPLETE: Data stored securely. Mech Codename: <strong class="text-yellow-400">${mechaCodename}</strong>`, 'success');
        } catch (error) {
            console.error('Supabase upload failed:', error);
            displayFeedback(`STORAGE ERROR: ${error.message}`, 'error');
        }
        
        setLoadingState(false);
        fileInput.value = '';
        imagePreview.innerHTML = '';
        uploadedFiles = [];
    });

    function displayFeedback(message, type = 'info', clearPrevious = true) {
        if (clearPrevious) {
            feedbackArea.innerHTML = '';
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `feedback-message feedback-${type}`;
        
        let iconType = 'info';
        if (type === 'success') iconType = 'check-circle';
        if (type === 'error') iconType = 'alert-triangle';
        
        const lowerMessage = message.toLowerCase();
        if (type === 'info' && (lowerMessage.includes('authenticating') || lowerMessage.includes('generating') || lowerMessage.includes('synthesis in progress') || lowerMessage.includes('processing'))) {
            iconType = 'loader';
            const loaderSpan = document.createElement('span');
            loaderSpan.className = 'loader-dots';
            loaderSpan.innerHTML = '<span></span><span></span><span></span>';
            messageDiv.appendChild(loaderSpan);
        } else {
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', iconType);
            messageDiv.appendChild(icon);
        }
        
        const textSpan = document.createElement('span');
        textSpan.innerHTML = message;
        messageDiv.appendChild(textSpan);

        feedbackArea.appendChild(messageDiv);
        lucide.createIcons();
    }
    
    function clearFeedback() {
        feedbackArea.innerHTML = '';
    }

    function setLoadingState(isLoading, message = null) {
        startProcessBtn.disabled = isLoading;
        fileInput.disabled = isLoading;
        emailInput.disabled = isLoading;
        descriptionInput.disabled = isLoading;
        
        if (isLoading && message) {
            startProcessBtn.innerHTML = ''; 
            const loaderSpan = document.createElement('span');
            loaderSpan.className = 'loader-dots';
            loaderSpan.innerHTML = '<span></span><span></span><span></span>';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = message;
            textSpan.className = 'ml-2';

            startProcessBtn.appendChild(loaderSpan);
            startProcessBtn.appendChild(textSpan);
        } else if (!isLoading) {
            startProcessBtn.innerHTML = '<i data-lucide="zap" class="mr-2"></i> Initiate Cyber-Fusion (Simulated)';
            lucide.createIcons(); 
        }
    }

    function simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 测试Supabase连接
    function initTestButton() {
      const testBtn = document.getElementById('testEmailBtn');
      if (!testBtn) return;
      
      testBtn.textContent = 'Test Supabase Connection';
      testBtn.addEventListener('click', async () => {
        try {
          const { data, error } = await supabase
            .from('payments')
            .select('*')
            .limit(1);
          
          if (error) throw error;
          alert('Supabase connection successful!');
        } catch (error) {
          alert(`Supabase test failed: ${error.message}`);
        }
      });
    }

    async function fetchLLMSpecifications(userDescription) {
        const prompt = `You are a data analyst in a cyberpunk world. Based on the following user requirements for a custom mecha: \"${userDescription}\", generate a cool, short 'Mecha Variant Codename' (e.g., 'Nightshade Striker', 'Kage Mk.III', 'Urban Phantom Mk.II') and a very brief, immersive (1-2 sentences) 'System Synthesis Log Excerpt' related to its creation. Respond ONLY with a JSON object in the format: {\"codename\": \"YOUR_GENERATED_CODENAME\", \"log_excerpt\": \"YOUR_GENERATED_LOG_EXCERPT\"}. Example: {\"codename\": \"Void Raptor\", \"log_excerpt\": \"Chassis resonance harmonized. Stealth matrix online. Combat subroutines for urban warfare compiled.\"}`;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-chat-v3-0324:free',
                    messages: [
                        { role: 'system', content: 'You are an AI assistant that generates cyberpunk mecha details.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 100,
                    temperature: 0.8,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("LLM API Error:", errorData);
                throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices.length > 0) {
                const content = data.choices[0].message.content;
                try {
                    let parsedContent = JSON.parse(content);

                    if (typeof parsedContent.codename === 'undefined') parsedContent.codename = "Parse Error: Codename";
                    if (typeof parsedContent.log_excerpt === 'undefined') parsedContent.log_excerpt = "Parse Error: Log";
                    return parsedContent;
                } catch (e) {
                    console.error("Error parsing LLM JSON response:", e, "Raw content:", content);

                    let codename = "Extraction Error";
                    let log_excerpt = "Log data corrupted. Standard parameters applied.";

                    const codenameRegex = new RegExp('"codename"\\s*:\\s*"([^"]+)"');
                    const logExcerptRegex = new RegExp('"log_excerpt"\\s*:\\s*"([^"]+)"');
                    
                    const codenameMatch = content.match(codenameRegex);
                    if (codenameMatch && codenameMatch[1]) {
                        codename = codenameMatch[1];
                    }

                    const logExcerptMatch = content.match(logExcerptRegex);
                    if (logExcerptMatch && logExcerptMatch[1]) {
                        log_excerpt = logExcerptMatch[1];
                    }
                    
                    if (codename === "Extraction Error" && content.includes("{") && content.includes("}")) {
                        try {
                            let cleanedContent = content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
                            const fallbackParsed = JSON.parse(cleanedContent);
                            if (fallbackParsed.codename) codename = fallbackParsed.codename;
                            if (fallbackParsed.log_excerpt) log_excerpt = fallbackParsed.log_excerpt;
                        } catch (jsonParseError) {
                            console.error("Fallback JSON parsing also failed:", jsonParseError);
                        }
                    }

                    return { codename: codename, log_excerpt: log_excerpt };
                }
            } else {
                throw new Error('No choices returned from LLM API.');
            }
        } catch (error) {
            console.error('Error fetching LLM specifications:', error);
            throw error; 
        }
    }
});
