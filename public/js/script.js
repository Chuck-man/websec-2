$(document).ready(function() {
    const apiBaseUrl = window.location.origin;
    let currentWeek = getCurrentWeek();
    
    // Инициализация
    $('#week').val(currentWeek);
    updateCurrentWeekDisplay();
    loadGroups();
    
    // Обработчики событий
    $('#loadSchedule').click(loadSchedule);
    $('#currentWeekBtn').click(setCurrentWeek);
    
    // Функции
    function getCurrentWeek() {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
        return Math.ceil(days / 7);
    }
    
    function updateCurrentWeekDisplay() {
        $('#currentWeekDisplay').text(`Текущая неделя: ${currentWeek}`);
    }
    
    function setCurrentWeek() {
        currentWeek = getCurrentWeek();
        $('#week').val(currentWeek);
        updateCurrentWeekDisplay();
    }
    
    function loadGroups() {
        showLoading(true);
        
        $.get(apiBaseUrl + '/api/groups')
            .done(function(data) {
                const $entityList = $('#entityList');
                $entityList.empty();
                $entityList.append('<option value="">Выберите группу</option>');
                
                if (data && data.length > 0) {
                    data.forEach(group => {
                        $entityList.append(`<option value="${group.id}">${group.name}</option>`);
                    });
                }
            })
            .fail(function() {
                alert('Ошибка при загрузке списка групп');
            })
            .always(function() {
                showLoading(false);
            });
    }
    
    function loadSchedule() {
        const groupId = $('#entityList').val();
        const week = $('#week').val();
        
        if (!groupId) {
            alert('Пожалуйста, выберите группу');
            return;
        }
        
        showLoading(true);
        $('#scheduleContainer').hide();
        
        $.get(apiBaseUrl + '/api/schedule', { groupId: groupId, week: week })
            .done(function(data) {
                if (data && data.schedule) {
                    displaySchedule(data);
                } else {
                    alert('Не удалось загрузить расписание');
                }
            })
            .fail(function() {
                alert('Ошибка при загрузке расписания');
            })
            .always(function() {
                showLoading(false);
            });
    }
    
    function displaySchedule(data) {
        const $container = $('#scheduleContainer');
        $container.empty();
        
        if (!data || !data.schedule || Object.keys(data.schedule).length === 0) {
            $container.html('<p class="no-data">Расписание не найдено</p>');
            $container.show();
            return;
        }
        
        // Устанавливаем заголовок
        $('#scheduleTitle').text(`Расписание группы ${data.groupName || data.name}`);
        $('#currentWeekDisplay').text(`Неделя: ${data.week}`);
        
        // Порядок дней недели
        const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        
        daysOrder.forEach((dayName, dayIndex) => {
            const dayLessons = [];
            
            // Собираем все занятия для этого дня
            for (const timeSlot in data.schedule) {
                if (data.schedule[timeSlot][dayName]) {
                    dayLessons.push({
                        time: timeSlot,
                        items: data.schedule[timeSlot][dayName]
                    });
                }
            }
            
            if (dayLessons.length > 0) {
                const $day = $(`
                    <div class="schedule-day">
                        <div class="day-header">
                            ${dayName} ${data.dates && data.dates[dayIndex] ? `(${data.dates[dayIndex]})` : ''}
                        </div>
                        <div class="lessons-list"></div>
                    </div>
                `);
                
                const $lessonsList = $day.find('.lessons-list');
                
                dayLessons.forEach(lesson => {
                    lesson.items.forEach(item => {
                        // Формируем элемент преподавателя (ссылку или текст)
                        let teacherElement = 'Преподаватель не указан';
                        if (item.teacher && item.teacherId) {
                            teacherElement = `<a href="#" class="teacher-link" data-teacher-id="${item.teacherId}">${item.teacher}</a>`;
                        } else if (item.teacher) {
                            teacherElement = item.teacher;
                        }
                        
                        // Формируем элемент занятия
                        const $lesson = $(`
                            <div class="lesson ${item.colorClass || ''}">
                                <div class="lesson-time">${lesson.time}</div>
                                <div class="lesson-details">
                                    <div class="lesson-subject">${item.subject || 'Не указано'}</div>
                                    <div class="lesson-meta">
                                        ${item.type ? `<span class="lesson-type">${item.type}</span>` : ''}
                                        ${item.location ? `<span class="lesson-classroom">${item.location}</span>` : ''}
                                        <span class="lesson-teacher">${teacherElement}</span>
                                    </div>
                                    ${item.groups && item.groups.length > 0 ? `
                                        <div class="lesson-groups">
                                            Группы: ${item.groups.map(g => g.name || g.id).join(', ')}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `);
                        
                        $lessonsList.append($lesson);
                    });
                });
                
                $container.append($day);
            }
        });
        
        // Добавляем обработчик клика на имя преподавателя
        $container.on('click', '.teacher-link', function(e) {
            e.preventDefault();
            const teacherId = $(this).data('teacher-id');
            if (teacherId) {
                loadTeacherSchedule(teacherId);
            }
        });
        
        $container.show();
    }
    
    function loadTeacherSchedule(teacherId) {
        const week = $('#week').val();
        
        showLoading(true);
        $('#scheduleContainer').hide();
        
        $.get(apiBaseUrl + '/api/schedule', { staffId: teacherId, week: week })
            .done(function(data) {
                if (data && data.schedule) {
                    displayTeacherSchedule(data);
                } else {
                    alert('Не удалось загрузить расписание преподавателя');
                }
            })
            .fail(function() {
                alert('Ошибка при загрузке расписания преподавателя');
            })
            .always(function() {
                showLoading(false);
            });
    }
    
    function displayTeacherSchedule(data) {
        const $container = $('#scheduleContainer');
        $container.empty();
        
        if (!data || !data.schedule || Object.keys(data.schedule).length === 0) {
            $container.html('<p class="no-data">Расписание преподавателя не найдено</p>');
            $container.show();
            return;
        }
        
        // Устанавливаем заголовок
        $('#scheduleTitle').text(`Расписание преподавателя ${data.teacherName || data.name}`);
        $('#currentWeekDisplay').text(`Неделя: ${data.week}`);
        
        // Порядок дней недели
        const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        
        daysOrder.forEach((dayName, dayIndex) => {
            const dayLessons = [];
            
            // Собираем все занятия для этого дня
            for (const timeSlot in data.schedule) {
                if (data.schedule[timeSlot][dayName]) {
                    dayLessons.push({
                        time: timeSlot,
                        items: data.schedule[timeSlot][dayName]
                    });
                }
            }
            
            if (dayLessons.length > 0) {
                const $day = $(`
                    <div class="schedule-day">
                        <div class="day-header">
                            ${dayName} ${data.dates && data.dates[dayIndex] ? `(${data.dates[dayIndex]})` : ''}
                        </div>
                        <div class="lessons-list"></div>
                    </div>
                `);
                
                const $lessonsList = $day.find('.lessons-list');
                
                dayLessons.forEach(lesson => {
                    lesson.items.forEach(item => {
                        // Формируем элемент группы
                        const groupsElement = item.groups && item.groups.length > 0 ? 
                            `<div class="lesson-groups">Группы: ${item.groups.map(g => g.name || g.id).join(', ')}</div>` : '';
                        
                        // Формируем элемент занятия
                        const $lesson = $(`
                            <div class="lesson ${item.colorClass || ''}">
                                <div class="lesson-time">${lesson.time}</div>
                                <div class="lesson-details">
                                    <div class="lesson-subject">${item.subject || 'Не указано'}</div>
                                    <div class="lesson-meta">
                                        ${item.type ? `<span class="lesson-type">${item.type}</span>` : ''}
                                        ${item.location ? `<span class="lesson-classroom">${item.location}</span>` : ''}
                                        <span class="lesson-teacher">${item.teacher || 'Преподаватель не указан'}</span>
                                    </div>
                                    ${groupsElement}
                                </div>
                            </div>
                        `);
                        
                        $lessonsList.append($lesson);
                    });
                });
                
                $container.append($day);
            }
        });
        
        // Добавляем кнопку "Назад к группе"
        $container.prepend(`
            <button id="backToGroup" class="back-button">← Вернуться к расписанию группы</button>
        `);
        
        $('#backToGroup').click(function() {
            const groupId = $('#entityList').val();
            if (groupId) {
                loadSchedule();
            }
        });
        
        $container.show();
    }
    
    function showLoading(show) {
        if (show) {
            $('#loading').show();
        } else {
            $('#loading').hide();
        }
    }
});