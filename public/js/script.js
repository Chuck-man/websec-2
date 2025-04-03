$(document).ready(function() {
    const apiBaseUrl = window.location.origin;
    let currentWeek = getCurrentWeek();
    
    // Инициализация
    $('#week').val(currentWeek);
    updateCurrentWeekDisplay();
    loadEntities();
    
    // Обработчики событий
    $('#entityType').change(loadEntities);
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
    
    function loadEntities() {
        const entityType = $('#entityType').val();
        const endpoint = entityType === 'group' ? '/api/groups' : '/api/teachers';
        
        showLoading(true);
        
        $.get(apiBaseUrl + endpoint)
            .done(function(data) {
                const $entityList = $('#entityList');
                $entityList.empty();
                
                if (data && data.length === 0) {
                    $entityList.append('<option value="">Нет данных</option>');
                    return;
                }
                
                if (data && data.length > 0) {
                    data.forEach(entity => {
                        $entityList.append(`<option value="${entity.id}">${entity.name}</option>`);
                    });
                }
            })
            .fail(function() {
                alert('Ошибка при загрузке данных');
            })
            .always(function() {
                showLoading(false);
            });
    }
    
    function loadSchedule() {
        const entityType = $('#entityType').val();
        const entityId = $('#entityList').val();
        const week = $('#week').val();
        
        if (!entityId) {
            alert('Пожалуйста, выберите группу или преподавателя');
            return;
        }
        
        showLoading(true);
        $('#scheduleContainer').hide();
        
        const params = {
            week: week
        };
        
        if (entityType === 'group') {
            params.groupId = entityId;
        } else {
            params.staffId = entityId;
        }
        
        $.get(apiBaseUrl + '/api/schedule', params)
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
        const title = data.type === 'group' 
            ? `Расписание группы ${data.name}` 
            : `Расписание преподавателя ${data.name}`;
        
        $('#scheduleTitle').text(title);
        $('#currentWeekDisplay').text(`Неделя: ${data.week}`);
        
        // Создаем расписание по дням
        const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        
        daysOrder.forEach((dayName, dayIndex) => {
            const dayData = {
                lessons: []
            };
            
            // Находим все занятия для этого дня
            for (const timeSlot in data.schedule) {
                if (data.schedule[timeSlot][dayName]) {
                    dayData.lessons.push({
                        time: timeSlot,
                        items: data.schedule[timeSlot][dayName]
                    });
                }
            }
            
            if (dayData.lessons.length > 0) {
                const $day = $(`
                    <div class="schedule-day">
                        <div class="day-header">
                            ${dayName} ${data.dates && data.dates[dayIndex] ? `(${data.dates[dayIndex]})` : ''}
                        </div>
                        <div class="lessons-list"></div>
                    </div>
                `);
                
                const $lessonsList = $day.find('.lessons-list');
                
                dayData.lessons.forEach(lesson => {
                    lesson.items.forEach(item => {
                        const $lesson = $(`
                            <div class="lesson">
                                <div class="lesson-time">${lesson.time}</div>
                                <div class="lesson-details">
                                    <div class="lesson-subject">${item.subject || 'Не указано'}</div>
                                    <div class="lesson-meta">
                                        ${item.type ? `<span class="lesson-type">${item.type}</span>` : ''}
                                        ${item.location ? `<span class="lesson-classroom">${item.location}</span>` : ''}
                                        ${item.teacher ? `<span class="lesson-teacher">${item.teacher}</span>` : ''}
                                    </div>
                                    ${item.groups && item.groups.length > 0 ? `
                                        <div class="lesson-groups">
                                            ${item.groups.map(group => `
                                                <span class="group-tag">${group.name || group.id}</span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `);
                        
                        if (item.colorClass) {
                            $lesson.addClass(item.colorClass);
                        }
                        
                        $lessonsList.append($lesson);
                    });
                });
                
                $container.append($day);
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