/**
 * reportGenerator.js - Uses pdfmake to generate the PDF report in Object-Oriented format
 */

const ReportGenerator = (() => {

    // (FACILITY_TYPES is now loaded from data/constants.js)

    async function generateProjectPDF(project, options = {}) {
        if (!project || !project.facilities || project.facilities.length === 0) {
            showToast('Нет объектов для генерации отчета.', 'danger');
            return;
        }

        const lang = options.lang || 'ru';
        const signatory = options.signatory || '________________________';
        const position = options.position || 'Специалист';
        const reportDate = options.date || new Date().toLocaleDateString('ru-RU');

        const docDefinition = {
            content: [],
            styles: {
                title: { fontSize: 24, bold: true, alignment: 'center', margin: [0, 150, 0, 20] },
                subtitle: { fontSize: 16, alignment: 'center', margin: [0, 0, 0, 50] },
                header: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 20, 0, 10] },
                sectionHeader: { fontSize: 14, bold: true, margin: [0, 20, 0, 10], color: '#1e293b' },
                facilityHeader: { fontSize: 13, bold: true, margin: [0, 15, 0, 5], color: '#0f172a' },
                subheader: { fontSize: 11, bold: true, margin: [0, 10, 0, 5], color: '#334155' },
                text: { fontSize: 10, margin: [0, 2, 0, 2] },
                boldText: { fontSize: 10, bold: true, margin: [0, 2, 0, 2] },
                tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#e2e8f0', alignment: 'center' },
                tableBody: { fontSize: 9, margin: [2, 2, 2, 2] },
                signatureBlock: { margin: [0, 40, 0, 0], fontSize: 11 }
            },
            defaultStyle: { font: 'Roboto' },
            footer: function(currentPage, pageCount) {
                return { text: currentPage.toString() + ' / ' + pageCount, alignment: 'center', fontSize: 9, margin: [0, 10, 0, 0] };
            }
        };

        const companyName = project.company || 'Организация (Заказчик)';
        const projectName = project.name || 'Новый проект';
        const license = project.license || '—';

        // -----------------------------------------------------
        // 1. Cover Page
        // -----------------------------------------------------
        const titleText = lang === 'kz' ? 'ШЫҒАРЫНДЫЛАРДЫ ЕСЕПТЕУ ТУРАЛЫ ЕСЕП' : 'ОТЧЕТ ПО РАСЧЕТУ ВЫБРОСОВ';
        docDefinition.content.push(
            { text: titleText, style: 'title' },
            { text: companyName, style: 'subtitle' },
            { text: `Проект: ${projectName}`, style: 'text', alignment: 'center', fontSize: 14, margin: [0,0,0,10] },
            { text: `Разрешительный документ: ${license}`, style: 'text', alignment: 'center' },
            { text: `Дата формирования: ${reportDate}`, style: 'text', alignment: 'center', margin: [0,20,0,0] },
            { text: '', pageBreak: 'after' }
        );

        // -----------------------------------------------------
        // 2. Table of Contents
        // -----------------------------------------------------
        docDefinition.content.push({
            toc: {
                title: { text: lang === 'kz' ? 'МАЗМҰНЫ' : 'СОДЕРЖАНИЕ', style: 'header' },
                numberStyle: { bold: true }
            }
        });
        docDefinition.content.push({ text: '', pageBreak: 'after' });

        // -----------------------------------------------------
        // 3. General Info
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? '1-БӨЛІМ: ЖАЛПЫ МӘЛІМЕТТЕР' : 'РАЗДЕЛ 1: ОБЩИЕ СВЕДЕНИЯ', style: 'sectionHeader', tocItem: true });
        docDefinition.content.push(
            { text: `Организация: ${companyName}`, style: 'text' },
            { text: `Название проекта: ${projectName}`, style: 'text' },
            { text: `Базовые координаты: ${project.lat || '-'}, ${project.lng || '-'}`, style: 'text' }
        );

        // -----------------------------------------------------
        // 3.5 Met Data Provenance
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? 'МЕТЕОРОЛОГИЯЛЫҚ ҚАМТАМАСЫЗ ЕТУ' : 'МЕТЕОРОЛОГИЧЕСКОЕ ОБЕСПЕЧЕНИЕ', style: 'sectionHeader', margin: [0, 20, 0, 10], tocItem: true });
        
        const gm = project.geo_meteo;
        const activeMet = gm && gm.met_datasets ? gm.met_datasets.find(d => d.id === gm.active_met_dataset_id) : null;
        
        if (activeMet) {
            let qualityLabel = 'СИНТЕТИЧЕСКИЕ / МОДЕЛЬНЫЕ (Внимание: Не для офиц. использования)';
            if (activeMet.data_quality === 'measured') qualityLabel = 'Фактические архивные данные (OpenMeteo API)';
            else if (activeMet.data_quality === 'regional_norm') qualityLabel = 'Региональные нормы (СП РК)';
            
            docDefinition.content.push({
                columns: [
                    { width: '50%', text: `Источник: ${activeMet.name || 'OpenMeteo'}`, style: 'text' },
                    { width: '50%', text: `Качество: ${qualityLabel}`, style: 'text', bold: activeMet.data_quality !== 'synthetic', color: activeMet.data_quality === 'synthetic' ? '#ef4444' : '#0f172a' }
                ]
            });
            
            if (activeMet.stability_freq) {
                const stabRows = [
                    [{text: 'Класс П-Г', style: 'tableHeader'}, {text: 'Частота (%)', style: 'tableHeader'}]
                ];
                Object.entries(activeMet.stability_freq).sort().forEach(([k, v]) => {
                    stabRows.push([{text: k, alignment: 'center'}, {text: v.toFixed(2), alignment: 'right'}]);
                });
                
                docDefinition.content.push(
                    { text: 'Распределение стратификации атмосферы (по Паскуиллу-Гиффорду):', style: 'subheader' },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['30%', '30%'],
                            body: stabRows
                        },
                        margin: [0, 0, 0, 15]
                    }
                );
            }
        } else {
            docDefinition.content.push({ text: 'Метеорологические данные не выбраны для данного проекта.', style: 'text', color: '#ef4444' });
        }

        // -----------------------------------------------------
        // 4. Facility Registry Table
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? '2-БӨЛІМ: ОБЪЕКТІЛЕР ТІЗІЛІМІ' : 'РАЗДЕЛ 2: ПЕРЕЧЕНЬ ОБЪЕКТОВ (ПЛОЩАДОК)', style: 'sectionHeader', tocItem: true, margin: [0, 30, 0, 10] });
        
        const facBody = [
            [{ text: '№', style: 'tableHeader' }, { text: lang === 'kz' ? 'Атауы' : 'Наименование площадки', style: 'tableHeader' }, { text: 'Тип', style: 'tableHeader' }, { text: 'Адрес', style: 'tableHeader' }]
        ];
        
        project.facilities.forEach((fac, idx) => {
            facBody.push([
                { text: (idx + 1).toString(), style: 'tableBody', alignment: 'center' },
                { text: fac.name, style: 'tableBody' },
                { text: (FACILITY_TYPES.find(t => t.value === fac.type) || {}).label || fac.type, style: 'tableBody' },
                { text: fac.address || '—', style: 'tableBody' }
            ]);
        });
        
        docDefinition.content.push({ table: { widths: ['auto', '*', 'auto', '*'], body: facBody }, margin: [0, 0, 0, 20] });

        // -----------------------------------------------------
        // 5. Per-Facility Sources List
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? '3-БӨЛІМ: ШЫҒАРЫНДЫ КӨЗДЕРІНІҢ ТІЗІМІ' : 'РАЗДЕЛ 3: ПЕРЕЧЕНЬ ИСТОЧНИКОВ ВЫБРОСОВ', style: 'sectionHeader', tocItem: true, margin: [0, 20, 0, 10] });
        
        project.facilities.forEach((fac, facIdx) => {
            docDefinition.content.push({ text: `Объект ${facIdx + 1}: ${fac.name}`, style: 'facilityHeader' });
            if (!fac.sources || fac.sources.length === 0) {
                docDefinition.content.push({ text: 'Нет источников выбросов', style: 'text', italics: true });
                return;
            }
            const srcBody = [
                [{ text: 'Код исч.', style: 'tableHeader' }, { text: 'Наименование источника', style: 'tableHeader' }, { text: 'Методика', style: 'tableHeader' }, { text: 'Формула', style: 'tableHeader' }]
            ];
            fac.sources.forEach((src, srcIdx) => {
                const sNum = src.source_number || `000${srcIdx + 1}`;
                srcBody.push([
                    { text: sNum, style: 'tableBody', alignment: 'center' },
                    { text: src.name || 'Безымянный источник', style: 'tableBody' },
                    { text: src.methodic_name || '-', style: 'tableBody' },
                    { text: src.formula_code || '-', style: 'tableBody', alignment: 'center' }
                ]);
            });
            docDefinition.content.push({ table: { widths: ['auto', '*', '*', 'auto'], body: srcBody }, margin: [0, 5, 0, 15] });
        });
        
        docDefinition.content.push({ text: '', pageBreak: 'after' });

        // -----------------------------------------------------
        // 6. Detailed Calculations (Appendix 6 logic)
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? '6-ҚОСЫМША: ШЫҒАРЫНДЫЛАРДЫ ЕСЕПТЕУ' : 'ПРИЛОЖЕНИЕ 6: РАСЧЁТ ВЫБРОСОВ', style: 'sectionHeader', tocItem: true });
        
        project.facilities.forEach((fac, facIdx) => {
            if (!fac.sources || fac.sources.length === 0) return;
            
            docDefinition.content.push({ 
                text: `Расчёты по объекту: ${fac.name}`, 
                style: 'facilityHeader', 
                tocItem: true, 
                tocMargin: [10, 0, 0, 0] 
            });

            fac.sources.forEach((src, srcIdx) => {
                const sNum = src.source_number || `000${srcIdx + 1}`;
                docDefinition.content.push({ text: `Источник ${sNum}: ${src.name || 'Безымянный'} — ${src.methodic_name}`, style: 'subheader', margin: [0, 15, 0, 5] });

                // Table 1: Source Characteristics
                docDefinition.content.push({ text: 'Таблица 1. Характеристика источника', style: 'text', bold: true, margin: [0,5,0,2] });
                docDefinition.content.push({
                    table: {
                        widths: ['*', '*'],
                        body: [
                            [{ text: 'Категория источника', style: 'tableHeader' }, { text: 'Формула', style: 'tableHeader' }],
                            [{ text: src.category === 'construction' ? 'Строительство' : 'Эксплуатация', style: 'tableBody' }, { text: src.formula_code || '—', style: 'tableBody' }]
                        ]
                    }, margin: [0,0,0,10]
                });

                // Table 2: Input parameters
                if (src.inputs) {
                    docDefinition.content.push({ text: 'Таблица 2. Исходные данные для расчета (включая коэффициенты)', style: 'text', bold: true, margin: [0,5,0,2] });
                    const paramBody = [[{ text: 'Параметр', style: 'tableHeader' }, { text: 'Значение', style: 'tableHeader' }]];
                    for (const [k, v] of Object.entries(src.inputs)) {
                        if (k.endsWith('_trace') || k.endsWith('_override')) continue;
                        paramBody.push([{ text: k, style: 'tableBody' }, { text: String(v), style: 'tableBody' }]);
                    }
                    docDefinition.content.push({ table: { widths: ['*', '*'], body: paramBody }, margin: [0,0,0,10] });
                }

                // Table 3: Calculation Steps
                if (src.results && src.results.calculation_steps) {
                    docDefinition.content.push({ text: 'Таблица 3. Последовательность вычислений', style: 'text', bold: true, margin: [0,5,0,2] });
                    const calcBody = [[
                        { text: 'Искомая величина', style: 'tableHeader' },
                        { text: 'Формула', style: 'tableHeader' },
                        { text: 'Подстановка', style: 'tableHeader' },
                        { text: 'Результат', style: 'tableHeader' }
                    ]];
                    src.results.calculation_steps.forEach(step => {
                        const resStr = typeof step.result === 'number' ? step.result.toFixed(6) : step.result;
                        calcBody.push([
                            { text: step.lhs, style: 'tableBody' },
                            { text: `${step.lhs} = ${step.raw}`, style: 'tableBody' },
                            { text: step.substituted, style: 'tableBody' },
                            { text: resStr, style: 'tableBody', bold: true }
                        ]);
                    });
                    docDefinition.content.push({ table: { widths: ['auto', '*', '*', 'auto'], body: calcBody }, margin: [0,0,0,10] });
                }

                // Table 4: Composition
                if (src.composition && src.composition.length > 0) {
                    docDefinition.content.push({ text: 'Таблица 4. Вещества и расчетные выбросы', style: 'text', bold: true, margin: [0,5,0,2] });
                    const compBody = [
                        [{ text: 'Код', style: 'tableHeader' }, { text: 'Загрязняющее вещество', style: 'tableHeader' }, { text: 'Доля (%)', style: 'tableHeader' }, { text: 'Макс. выброс (г/с)', style: 'tableHeader' }, { text: 'Годовой выброс (т/год)', style: 'tableHeader' }]
                    ];
                    src.composition.forEach(c => {
                        const m_part = (src.M != null ? src.M : (src.results && src.results.M || 0)) * (c.pct / 100);
                        const g_part = (src.G != null ? src.G : (src.results && src.results.G || 0)) * (c.pct / 100);
                        compBody.push([
                            { text: c.code || '—', style: 'tableBody', alignment: 'center' },
                            { text: c.name, style: 'tableBody' },
                            { text: c.pct.toFixed(2), style: 'tableBody', alignment: 'center' },
                            { text: m_part.toFixed(6), style: 'tableBody', alignment: 'right' },
                            { text: g_part.toFixed(6), style: 'tableBody', alignment: 'right' }
                        ]);
                    });
                    docDefinition.content.push({ table: { widths: ['auto', '*', 'auto', 'auto', 'auto'], body: compBody }, margin: [0,0,0,20] });
                }
            });
            
            // Facility subtotal
            let facM = 0; let facG = 0;
            fac.sources.forEach(s => {
                facM += (s.M || (s.results && s.results.M) || 0);
                facG += (s.G || (s.results && s.results.G) || 0);
            });
            
            docDefinition.content.push({ 
                text: `Итого по объекту "${fac.name}":   М = ${facM.toFixed(6)} г/с,   G = ${facG.toFixed(6)} т/год`, 
                style: 'boldText', 
                alignment: 'right',
                margin: [0, 0, 0, 30] 
            });
        });

        docDefinition.content.push({ text: '', pageBreak: 'after' });

        // -----------------------------------------------------
        // 7. Project Summary & Pollutant Aggregation
        // -----------------------------------------------------
        docDefinition.content.push({ text: lang === 'kz' ? 'ЖОБА БОЙЫНША ҚОРЫТЫНДЫ' : 'СВОДНАЯ ИНФОРМАЦИЯ ПО ПРОЕКТУ', style: 'sectionHeader', tocItem: true });
        
        // Calculate aggregations
        let totalM = 0; let totalG = 0;
        const pollutantMap = {};
        
        project.facilities.forEach(fac => {
            if (!fac.sources) return;
            fac.sources.forEach(s => {
                const sM = (s.M || (s.results && s.results.M) || 0);
                const sG = (s.G || (s.results && s.results.G) || 0);
                totalM += sM;
                totalG += sG;
                
                if (s.composition) {
                    s.composition.forEach(c => {
                        if (!pollutantMap[c.name]) pollutantMap[c.name] = { M: 0, G: 0, code: c.code || '—' };
                        pollutantMap[c.name].M += sM * (c.pct / 100);
                        pollutantMap[c.name].G += sG * (c.pct / 100);
                    });
                }
            });
        });

        docDefinition.content.push(
            { text: `Валовый выброс по проекту: ${totalG.toFixed(6)} т/год`, style: 'boldText', margin: [0,0,0,5] },
            { text: `Максимальный выброс по проекту: ${totalM.toFixed(6)} г/с`, style: 'boldText', margin: [0,0,0,15] }
        );

        docDefinition.content.push({ text: 'Сводная таблица по загрязняющим веществам', style: 'subheader' });
        
        const sumBody = [
            [{ text: 'Код', style: 'tableHeader' }, { text: 'Наименование вещества', style: 'tableHeader' }, { text: 'M (г/с)', style: 'tableHeader' }, { text: 'G (т/год)', style: 'tableHeader' }]
        ];
        
        Object.keys(pollutantMap).sort().forEach(p => {
            sumBody.push([
                { text: pollutantMap[p].code || '—', style: 'tableBody', alignment: 'center' },
                { text: p, style: 'tableBody' },
                { text: pollutantMap[p].M.toFixed(6), style: 'tableBody', alignment: 'right' },
                { text: pollutantMap[p].G.toFixed(6), style: 'tableBody', alignment: 'right' }
            ]);
        });

        docDefinition.content.push({ table: { widths: ['*', 'auto', 'auto'], body: sumBody }, margin: [0,0,0,30] });

        // -----------------------------------------------------
        // 8. Signature Block
        // -----------------------------------------------------
        docDefinition.content.push({
            style: 'signatureBlock',
            columns: [
                { text: `${position}: ${signatory}`, width: '*' },
                { text: 'Проверил (Гл. эколог): ________________________', width: '*' }
            ]
        });

        return new Promise((resolve) => {
            pdfMake.createPdf(docDefinition).getBlob((blob) => {
                resolve(blob);
            });
        });
    }

    return { generateProjectPDF };
})();
