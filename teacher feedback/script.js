// ========== 阿里云百炼 API 配置 ==========
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const API_KEY = 'sk-581d84f38bb74e02bac28917623796a6';  // ⚠️ 请换成你自己的Key
const MODEL = 'qwen-plus';

// ========== 数据管理 ==========
const STORAGE_KEY = 'teacher_feedback_students';

function getAllStudents() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveAllStudents(students) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function getStudentById(id) {
    const students = getAllStudents();
    return students.find(s => s.id === id);
}

function updateStudent(id, updateFn) {
    const students = getAllStudents();
    const index = students.findIndex(s => s.id === id);
    if (index !== -1) {
        updateFn(students[index]);
        saveAllStudents(students);
        return true;
    }
    return false;
}

function createStudent(name, grade, subject, gender, parent) {
    const students = getAllStudents();
    const newStudent = {
        id: Date.now().toString(),
        name: name,
        gender: gender,
        grade: grade,
        subject: subject,
        parent: parent,
        feedbacks: []
    };
    students.push(newStudent);
    saveAllStudents(students);
    return newStudent;
}

function deleteStudent(id) {
    const students = getAllStudents();
    const filtered = students.filter(s => s.id !== id);
    saveAllStudents(filtered);
}

// ========== 页面判断 ==========
const isHomePage = window.location.pathname.endsWith('index.html') || 
                   window.location.pathname.endsWith('/') ||
                   window.location.pathname.endsWith('/teacher%20feedback/') ||
                   window.location.pathname.endsWith('/teacher feedback/');

const isStudentPage = window.location.pathname.includes('student.html');

// ========== 首页逻辑 ==========

window.toggleSubjectTag = function(tag) {
    tag.classList.toggle('selected');
    updateSelectedSubjects();
};

function updateSelectedSubjects() {
    const selectedTags = document.querySelectorAll('.subject-tag.selected');
    const subjects = Array.from(selectedTags).map(tag => tag.getAttribute('data-value'));
    document.getElementById('newSubject').value = subjects.join(',');
}

if (isHomePage) {
    function renderStudentList() {
        const students = getAllStudents();
        const listContainer = document.getElementById('studentList');
        const emptyState = document.getElementById('emptyState');
        
        if (students.length === 0) {
            listContainer.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        listContainer.innerHTML = students.map(student => `
            <div class="student-card">
                <div class="student-card-content" onclick="goToStudent('${student.id}')">
                    <h3>${student.name} ${student.gender === '男' ? '👦' : '👧'}</h3>
                    <p>${student.grade}</p>
                    <p class="student-subjects">📖 ${student.subject}</p>
                    <p class="feedback-count">📋 ${student.feedbacks.length} 条反馈</p>
                </div>
                <button class="delete-student-btn" onclick="deleteStudentConfirm('${student.id}', '${student.name}')" title="删除学生">
                    🗑️
                </button>
            </div>
        `).join('');
    }
    
    window.deleteStudentConfirm = function(studentId, studentName) {
        if (confirm(`确定要删除学生"${studentName}"吗？\n所有历史反馈记录也会被删除，此操作不可恢复。`)) {
            deleteStudent(studentId);
            renderStudentList();
            alert(`学生"${studentName}"已删除`);
        }
    };
    
    window.goToStudent = function(studentId) {
        window.location.href = `student.html?id=${studentId}`;
    };
    
    window.openNewStudentModal = function() {
        document.getElementById('newStudentModal').style.display = 'flex';
        document.getElementById('newName').value = '';
        document.getElementById('newGrade').value = '';
        document.getElementById('newSubject').value = '';
        
        document.querySelectorAll('.subject-tag').forEach(tag => {
            tag.classList.remove('selected');
        });
        
        const genderRadios = document.querySelectorAll('input[name="gender"]');
        genderRadios.forEach(radio => radio.checked = false);
        
        const parentRadios = document.querySelectorAll('input[name="parent"]');
        parentRadios.forEach(radio => radio.checked = false);
    };
    
    window.closeNewStudentModal = function() {
        document.getElementById('newStudentModal').style.display = 'none';
    };
    
    window.createNewStudent = function() {
        const name = document.getElementById('newName').value.trim();
        const grade = document.getElementById('newGrade').value;
        const subject = document.getElementById('newSubject').value;
        
        const genderRadio = document.querySelector('input[name="gender"]:checked');
        const parentRadio = document.querySelector('input[name="parent"]:checked');
        const gender = genderRadio ? genderRadio.value : '';
        const parent = parentRadio ? parentRadio.value : '';
        
        if (!name || !grade || !subject || !gender || !parent) {
            alert('请填写完整信息（姓名、年级、科目、性别、发送对象）');
            return;
        }
        
        const newStudent = createStudent(name, grade, subject, gender, parent);
        closeNewStudentModal();
        renderStudentList();
        
        if (confirm(`学生"${name}"创建成功！是否立即进入？`)) {
            goToStudent(newStudent.id);
        }
    };
    
    renderStudentList();
}

// ========== 学生详情页逻辑 ==========
if (isStudentPage) {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');
    
    let currentStudent = null;
    let currentPreviewFeedback = '';
    let imageBase64List = [];
    
    function initStudentPage() {
        if (!studentId) {
            alert('未找到学生信息');
            goBack();
            return;
        }
        
        currentStudent = getStudentById(studentId);
        if (!currentStudent) {
            alert('学生不存在');
            goBack();
            return;
        }
        
        document.getElementById('displayName').textContent = currentStudent.name;
        document.getElementById('displayGender').textContent = currentStudent.gender || '-';
        document.getElementById('displayGrade').textContent = currentStudent.grade;
        document.getElementById('displaySubject').textContent = currentStudent.subject;
        document.getElementById('displayParent').textContent = currentStudent.parent || '-';
        document.getElementById('pageTitle').textContent = `📖 ${currentStudent.name}的反馈记录`;
        
        renderFeedbackHistory();
        document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);
    }
    
    async function handlePhotoUpload(e) {
        const files = e.target.files;
        imageBase64List = [];
        
        for (let file of files) {
            const base64 = await compressAndConvertToBase64(file);
            imageBase64List.push(base64);
        }
        
        const countSpan = document.getElementById('selectedCount');
        const photoCountSmall = document.getElementById('photoCount');
        if (countSpan && photoCountSmall) {
            countSpan.textContent = imageBase64List.length;
            photoCountSmall.style.display = imageBase64List.length > 0 ? 'inline-block' : 'none';
        }
    }
    
    async function compressAndConvertToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
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
                    
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    function renderFeedbackHistory() {
        const historyContainer = document.getElementById('feedbackHistory');
        const noHistory = document.getElementById('noHistory');
        const feedbacks = currentStudent.feedbacks || [];
        
        if (feedbacks.length === 0) {
            historyContainer.innerHTML = '';
            noHistory.style.display = 'block';
            return;
        }
        
        noHistory.style.display = 'none';
        const sortedFeedbacks = [...feedbacks].reverse();
        
        historyContainer.innerHTML = sortedFeedbacks.map((fb, index) => `
            <div class="feedback-item">
                <div class="feedback-item-header">
                    <span class="feedback-date">📅 ${fb.date}</span>
                    <span class="feedback-topic">${fb.topic}</span>
                </div>
                <div class="feedback-content">${fb.content}</div>
                <div class="feedback-actions">
                    <button class="btn-small" onclick="copyHistoryFeedback(${index})">📋 复制</button>
                    <button class="btn-small" onclick="deleteFeedback('${fb.date}')">🗑️ 删除</button>
                </div>
            </div>
        `).join('');
    }
    
    window.copyHistoryFeedback = function(index) {
        const feedbacks = [...currentStudent.feedbacks].reverse();
        const fb = feedbacks[index];
        navigator.clipboard.writeText(fb.content).then(() => {
            alert('已复制到剪贴板');
        });
    };
    
    window.deleteFeedback = function(date) {
        if (!confirm('确定删除这条反馈吗？')) return;
        
        updateStudent(studentId, (student) => {
            student.feedbacks = student.feedbacks.filter(f => f.date !== date);
        });
        
        currentStudent = getStudentById(studentId);
        renderFeedbackHistory();
    };
    
    window.toggleNewFeedback = function() {
        const panel = document.getElementById('newFeedbackPanel');
        const icon = document.getElementById('toggleIcon');
        
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            icon.textContent = '▼';
        } else {
            panel.classList.add('collapsed');
            icon.textContent = '▶';
        }
    };
    
    window.generateAndSaveFeedback = async function() {
        const lessonTopic = document.getElementById('lessonTopic').value.trim();
        const lessonContent = document.getElementById('lessonContent').value.trim();
        const extraNote = document.getElementById('extraNote').value.trim();
        
        if (!lessonTopic || !lessonContent) {
            alert('请填写本节课主题和学习内容');
            return;
        }
        
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = '⏳ AI 生成中...';
        btn.disabled = true;
        
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');
        previewSection.style.display = 'block';
        previewContent.innerHTML = '<span style="color: #999;">⏳ AI 正在分析信息，生成专业反馈中...</span>';
        
        try {
            const salutation = currentStudent.parent === '爸爸' ? '爸爸' : 
                               currentStudent.parent === '妈妈' ? '妈妈' : '家长';
            
            let prompt = `你是一位专业的${currentStudent.grade}${currentStudent.subject}老师，说话温暖、接地气。

请根据以下信息，写一段给${currentStudent.name}${currentStudent.parent}的课后反馈：

【学生】${currentStudent.name}（${currentStudent.grade}，${currentStudent.gender}生）
【本节课主题】${lessonTopic}
【学习内容与完成情况】${lessonContent}`;

            if (extraNote) {
                prompt += `\n【补充说明】${extraNote}`;
            }

            prompt += `\n\n要求：
1. 开头称呼"${currentStudent.name}${salutation}好"
2. 结合${currentStudent.grade}的学情特点和${currentStudent.gender}生的学习特点来分析
3. 优点要具体，不足要委婉，建议要可操作
4. 语气亲切自然，但是还是要得体且专业
5. 直接输出内容，字数参考300字左右
6. 【范文1】后半节课我给兜兜做了一个关于景物描写和画面联想的阅读，讲解了点面结合的答题方法和细节描写的内容，兜兜对点和面的描写能够区分清楚并且自己造句辨析，对于题目理解也非常准确。然后完成了一个点面结合的阅读练习，看出她掌握得很不错，但是有时候回答还是没有结合文章内容，我都通过题目给她提醒和纠正了
【范文2】兜兜妈妈，今天兜兜完成了说明文的四大说明方法的比较和分析作用，能看出她对于说明方法作用的记忆是比较准确的，但是她有时候忘记在回答中结合文章内容，我都给她指正了。说明文阅读在小学阅读理解中并不算难题，主要是考察说明方法的分析和一些关联词、病句、词语的分析，兜兜在这些方面做得都不错。
剩下一个小时完成了方程进阶练习题，她还是有几道题不太明白，特别是根据题目中的数量关系来列方程，容易找不到方法和等式，所以之后的练习我还是会穿插一些方程应用。另外我还发现她解方程计算时有点问题，所以让她写了五道解方程计算题，都是错在计算失误上，计算问题也需要重视。
【范文3】今天兜兜完成了关于根据文本想象画面、联系生活实际谈感想、根据文中的事物/场景进行联想，体会作者情感三大考点合一的一道语文阅读题，我发现她提取文章主旨的速度很快，理解能力较强，并且可以结合生活实际回答问题。我主要讲解了如何回答这几类题目和这些题目的不同问法，也和她一起思考了很多参考答案之外的解答，有一点点不足就是她对这类题目的回答重点有些混淆，容易多答，我也都给她修正了。
然后又花了十五分钟左右做了两道数学列方程进阶题，她容易对题目理解不到位导致找不到等量关系，我还是会多给她找类似的等量关系让她理解记忆（比如利润=售价-成本、路程=速度×时间）
7. 不可以虚构任何内容，实事求是，如果当天完成任务较少可以对学生提出建设性建议，但是没有提过的内容千万不要写`;

            const messages = [
                {
                    role: 'system',
                    content: `你是一位专业的${currentStudent.grade}${currentStudent.subject}老师，擅长撰写得体的家长沟通反馈。注意学生的性别是${currentStudent.gender}，家长称呼是${currentStudent.parent}。`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];
            
            if (imageBase64List.length > 0) {
                const imageContent = imageBase64List.map(base64 => ({
                    type: 'image_url',
                    image_url: { url: base64 }
                }));
                
                messages[1].content = [
                    { type: 'text', text: prompt },
                    ...imageContent
                ];
            }
            
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
                    max_tokens: 600
                })
            });
            
            const data = await response.json();
            
            if (data.choices && data.choices[0]) {
                currentPreviewFeedback = data.choices[0].message.content;
                previewContent.innerText = currentPreviewFeedback;
            } else {
                throw new Error(data.error?.message || '生成失败');
            }
            
        } catch (error) {
            console.error('生成失败:', error);
            previewContent.innerHTML = `<span style="color: #e74c3c;">❌ 生成失败：${error.message}</span>`;
            currentPreviewFeedback = '';
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };
    
    window.copyPreview = function() {
        if (!currentPreviewFeedback) {
            alert('没有可复制的内容');
            return;
        }
        navigator.clipboard.writeText(currentPreviewFeedback).then(() => {
            alert('已复制到剪贴板');
        });
    };
    
    window.saveCurrentFeedback = function() {
        if (!currentPreviewFeedback) {
            alert('请先生成反馈内容');
            return;
        }
        
        const lessonTopic = document.getElementById('lessonTopic').value.trim();
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        updateStudent(studentId, (student) => {
            student.feedbacks.push({
                date: dateStr,
                topic: lessonTopic,
                content: currentPreviewFeedback
            });
        });
        
        currentStudent = getStudentById(studentId);
        renderFeedbackHistory();
        
        document.getElementById('lessonTopic').value = '';
        document.getElementById('lessonContent').value = '';
        document.getElementById('extraNote').value = '';
        document.getElementById('photoInput').value = '';
        imageBase64List = [];
        document.getElementById('photoCount').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        currentPreviewFeedback = '';
        
        alert('反馈已保存！');
    };
    
    window.goBack = function() {
        window.location.href = 'index.html';
    };
    
    initStudentPage();
}
