const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const config = {
    ssauBaseUrl: 'https://ssau.ru',
    raspEndpoint: '/rasp',
    port: 3000,
    // Жестко заданные группы, которые вам нужны
    groups: [
        { id: "1282690301", name: "6411-100503D" },
        { id: "1282690279", name: "6412-100503D" },
        { id: "1213641978", name: "6413-100503D" }
    ],
    weeksInSemester: 52
};

// API для получения списка групп
app.get('/api/groups', (req, res) => {
    // Возвращаем только те группы, которые указаны в конфиге
    const simplifiedGroups = config.groups.map(group => ({
        id: group.id,
        name: group.name.split('-')[0] // Возвращаем только "6411", "6412", "6413"
    }));
    res.json(simplifiedGroups);
});

// API для получения списка преподавателей (оставим как есть)
app.get('/api/teachers', async (req, res) => {
    try {
        const url = `${config.ssauBaseUrl}${config.raspEndpoint}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const teachers = [];
        $('select[name="staffId"] option').each((index, element) => {
            const staffId = $(element).attr('value');
            const teacherName = $(element).text().trim();
            
            if (staffId && teacherName && staffId !== '0') {
                teachers.push({
                    id: staffId,
                    name: teacherName
                });
            }
        });

        res.json(teachers);
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ error: 'Failed to retrieve teachers' });
    }
});

// API для получения расписания
app.get('/api/schedule', async (req, res) => {
    const { groupId, staffId, week } = req.query;
    
    if (!groupId && !staffId) {
        return res.status(400).json({ error: 'Missing groupId or staffId' });
    }

    // Если запрашиваем группу, проверяем что она есть в нашем списке
    if (groupId && !config.groups.some(g => g.id === groupId)) {
        return res.status(404).json({ error: 'Group not found' });
    }

    try {
        let url, type, name;
        
        if (groupId) {
            // Находим полное имя группы по ID
            const group = config.groups.find(g => g.id === groupId);
            name = group ? group.name : `Группа ${groupId}`;
            url = `${config.ssauBaseUrl}${config.raspEndpoint}?groupId=${groupId}`;
            type = 'group';
        } else {
            url = `${config.ssauBaseUrl}${config.raspEndpoint}?staffId=${staffId}`;
            type = 'teacher';
            name = `Преподаватель ${staffId}`;
        }

        // Добавляем неделю, если указана
        if (week) {
            url += `&selectedWeek=${week}`;
        }

        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Парсим расписание
        const scheduleData = parseSchedule($);
        
        // Пытаемся получить имя из заголовка страницы
        const pageName = $('.schedule__head-title').text().trim();
        if (pageName) {
            name = pageName;
        }

        // Получаем даты для каждого дня
        const dates = [];
        $('.schedule__item.schedule__head').each((index, elem) => {
            const date = $(elem).find('.caption-text.schedule__head-date').text().trim();
            if (date) dates.push(date);
        });

        res.json({
            name: name,
            type: type,
            week: week || 'current',
            dates: dates,
            schedule: scheduleData,
            groupId: groupId || null,
            staffId: staffId || null
        });
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Failed to retrieve schedule' });
    }
});

// Функция для парсинга расписания (оставим вашу версию)
function parseSchedule($) {
    const scheduleData = {};
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dates = [];

    $('.schedule__item.schedule__head').each((index, elem) => {
        const date = $(elem).find('.caption-text.schedule__head-date').text().trim();
        if (date) dates.push(date);
    });

    const timeSlots = [];
    $('.schedule__time-item').each((index, element) => {
        const time = $(element).text().trim();
        timeSlots.push(time);
    });

    const timeIntervals = [];
    for (let i = 0; i < timeSlots.length; i += 2) {
        timeIntervals.push(`${timeSlots[i]} - ${timeSlots[i + 1]}`);
    }

    timeIntervals.forEach(time => {
        scheduleData[time] = {};
        daysOfWeek.forEach(day => {
            scheduleData[time][day] = [];
        });
    });

    $('.schedule__item:not(.schedule__head)').each((index, element) => {
        const dayIndex = index % daysOfWeek.length;
        const timeIndex = Math.floor(index / daysOfWeek.length);
        const time = timeIntervals[timeIndex];
        const day = daysOfWeek[dayIndex];
        const lessons = [];

        $(element).find('.schedule__lesson').each((_, lessonElement) => {
            const lesson = $(lessonElement);
            const typeClass = lesson.find('.schedule__lesson-type-chip').attr('class') || '';
            const subject = lesson.find('.body-text.schedule__discipline').text().trim();
            const location = lesson.find('.caption-text.schedule__place').text().trim();

            let teacherName = "Преподаватель неизвестен";
            let teacherId = null;

            try {
                const teacherLink = lesson.find('.schedule__teacher a');
                teacherName = teacherLink.text().trim();
                teacherId = teacherLink.attr('href') ? teacherLink.attr('href').split('staffId=')[1] : null;
            } catch (err) {
                console.warn("Could not extract teacher information:", err);
            }

            const groups = [];
            lesson.find('a.caption-text.schedule__group').each((_, groupElem) => {
                const groupName = $(groupElem).text().trim();
                const groupId = $(groupElem).attr('href') ? $(groupElem).attr('href').split('groupId=')[1] : null;
                groups.push({ id: groupId, name: groupName });
            });

            let colorClass = '';
            if (typeClass.includes('lesson-type-1__bg')) {
                colorClass = 'green';
            } else if (typeClass.includes('lesson-type-2__bg')) {
                colorClass = 'pink';
            } else if (typeClass.includes('lesson-type-3__bg')) {
                colorClass = 'blue';
            } else if (typeClass.includes('lesson-type-4__bg')) {
                colorClass = 'orange';
            } else if (typeClass.includes('lesson-type-5__bg')) {
                colorClass = 'dark-blue';
            } else if (typeClass.includes('lesson-type-6__bg')) {
                colorClass = 'turquoise';
            }
            
            lessons.push({
                subject: subject,
                location: location,
                teacher: teacherName,
                teacherId: teacherId,
                groups: groups,
                colorClass: colorClass
            });
        });

        scheduleData[time][day] = lessons;
    });
    
    return scheduleData;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});