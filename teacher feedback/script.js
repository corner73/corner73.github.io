// 阿里云百炼 API 配置
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const API_KEY = 'sk-581d84f38bb74e02bac28917623796a6';
const MODEL = 'qwen-plus';

// 存储图片的 Base64 数据
let imageBase64List = [];

// 监听图片上传
document.getElementById('photoInput').addEventListener('change', async function(e) {
    const files = e.target.files;
    imageBase64List = [];
    
    for (let file of files) {
        // 压缩图片以减少 token 消耗
        const base64 = await compressAndConvertToBase64(file);
        imageBase64List.push(base64);
    }
    
    console.log(`已加载 ${imageBase64List.length} 张图片`);
});

// 压缩图片并转为 Base64
async function compressAndConvertToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 限制最大尺寸为 1024px
                let width = img.width;
                let height = img.height;
                const maxSize = 1024;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // 压缩质量 0.7
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 生成反馈
async function generateFeedback() {
    const studentName = document.getElementById('studentName').value.trim();
    const lessonTopic = document.getElementById('lessonTopic').value.trim();
    const lessonContent = document.getElementById('lessonContent').value.trim();
    const extraNote = document.getElementById('extraNote').value.trim();
    
    // 验证必填项
    if (!studentName || !lessonTopic || !lessonContent) {
        alert('请填写学生姓名、本节课主题和学习内容');
        return;
    }
    
    // 更新按钮状态
    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerText;
    btn.innerText = '⏳ AI 正在生成反馈...';
    btn.disabled = true;
    btn.classList.add('loading');
    
    // 清空结果区域，显示加载状态
    const resultBox = document.getElementById('feedbackResult');
    resultBox.innerHTML = '<span class="placeholder">⏳ AI 正在分析信息，生成专业反馈中...</span>';
    
    try {
        // 构建 Prompt
        let prompt = `请模仿以下范文的风格和结构，根据新学生的信息写一段家长反馈：

【范文1】后半节课我给兜兜做了一个关于景物描写和画面联想的阅读，讲解了点面结合的答题方法和细节描写的内容，兜兜对点和面的描写能够区分清楚并且自己造句辨析，对于题目理解也非常准确。然后完成了一个点面结合的阅读练习，看出她掌握得很不错，但是有时候回答还是没有结合文章内容，我都通过题目给她提醒和纠正了
【范文2】兜兜妈妈，今天兜兜完成了说明文的四大说明方法的比较和分析作用，能看出她对于说明方法作用的记忆是比较准确的，但是她有时候忘记在回答中结合文章内容，我都给她指正了。说明文阅读在小学阅读理解中并不算难题，主要是考察说明方法的分析和一些关联词、病句、词语的分析，兜兜在这些方面做得都不错。
剩下一个小时完成了方程进阶练习题，她还是有几道题不太明白，特别是根据题目中的数量关系来列方程，容易找不到方法和等式，所以之后的练习我还是会穿插一些方程应用。另外我还发现她解方程计算时有点问题，所以让她写了五道解方程计算题，都是错在计算失误上，计算问题也需要重视。
【范文3】今天兜兜完成了关于根据文本想象画面、联系生活实际谈感想、根据文中的事物/场景进行联想，体会作者情感三大考点合一的一道语文阅读题，我发现她提取文章主旨的速度很快，理解能力较强，并且可以结合生活实际回答问题。我主要讲解了如何回答这几类题目和这些题目的不同问法，也和她一起思考了很多参考答案之外的解答，有一点点不足就是她对这类题目的回答重点有些混淆，容易多答，我也都给她修正了。
然后又花了十五分钟左右做了两道数学列方程进阶题，她容易对题目理解不到位导致找不到等量关系，我还是会多给她找类似的等量关系让她理解记忆（比如利润=售价-成本、路程=速度×时间）

【新学生信息】
姓名：${studentName}
本节课：${lessonTopic}
完成情况：${lessonContent}
${extraNote ? `备注：${extraNote}` : ''}

请直接输出模仿范文风格写的新反馈，不要加任何其他内容。`;

        // 构建消息
        const messages = [
            {
                role: 'system',
                content: '你是一位专业且富有爱心的老师，擅长撰写得体的家长沟通反馈。你的语言温暖、具体、有建设性。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];
        
        // 如果有图片，添加图片内容
        if (imageBase64List.length > 0) {
            // 将图片作为用户消息的一部分
            const imageContent = imageBase64List.map(base64 => ({
                type: 'image_url',
                image_url: { url: base64 }
            }));
            
            messages[1].content = [
                { type: 'text', text: prompt },
                ...imageContent
            ];
        }
        
        // 调用阿里云百炼 API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                temperature: 0.7,
                max_tokens: 800
            })
        });
        
        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const feedback = data.choices[0].message.content;
            resultBox.innerText = feedback;
            document.getElementById('copyBtn').style.display = 'block';
        } else {
            console.error('API 返回错误:', data);
            throw new Error(data.error?.message || data.message || '生成失败，请检查控制台');
        }
        
    } catch (error) {
        console.error('生成失败:', error);
        resultBox.innerHTML = `<span style="color: #e74c3c;">❌ 生成失败：${error.message}</span>`;
        document.getElementById('copyBtn').style.display = 'none';
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

// 复制反馈内容
function copyFeedback() {
    const feedbackText = document.getElementById('feedbackResult').innerText;
    navigator.clipboard.writeText(feedbackText).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.innerText = '✅ 已复制';
        setTimeout(() => {
            btn.innerText = '📋 复制';
        }, 2000);
    }).catch(err => {
        alert('复制失败，请手动复制');
    });
}

// 支持回车键快捷生成（Ctrl+Enter）
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        generateFeedback();
    }
});
