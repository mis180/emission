/**
 * reportGenerator.js - Uses pdfmake to generate the PDF report in Appendix 6 format
 */

const ReportGenerator = (() => {

    async function generatePDF(project) {
        if (!project || !project.sources || project.sources.length === 0) {
            alert('Нет источников для генерации отчета.');
            return;
        }

        const docDefinition = {
            content: [],
            styles: {
                header: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
                appendixHeader: { fontSize: 12, bold: true, alignment: 'right', margin: [0, 0, 0, 20] },
                subheader: { fontSize: 12, bold: true, margin: [0, 15, 0, 5], color: '#333' },
                text: { fontSize: 10, margin: [0, 2, 0, 2] },
                tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#f2f2f2', alignment: 'center' },
                tableBody: { fontSize: 9, margin: [2, 2, 2, 2] },
                signatureBlock: { margin: [0, 40, 0, 0], fontSize: 11 }
            },
            defaultStyle: { font: 'Roboto' }
        };

        const companyName = project.name || 'ТОО "Пример"';
        const dateStr = new Date().toLocaleDateString('ru-RU');

        // Appendix 6 Header
        docDefinition.content.push({ text: 'Приложение 6\nк Правилам расчета выбросов', style: 'appendixHeader' });
        docDefinition.content.push({ text: `ОТЧЕТ ПО РАСЧЕТУ ВЫБРОСОВ\n${companyName}`, style: 'header' });
        docDefinition.content.push({ text: `Проект: ${project.name}\nДата формирования: ${dateStr}`, style: 'text', alignment: 'center', margin: [0,0,0,20] });

        for (let idx = 0; idx < project.sources.length; idx++) {
            const src = project.sources[idx];
            
            docDefinition.content.push({ text: `Источник №${idx + 1}: ${src.name} — ${src.methodic_name}`, style: 'subheader' });

            // Table 1: Source Characteristics
            docDefinition.content.push({ text: 'Таблица 1. Характеристика источника', style: 'text', bold: true, margin: [0,10,0,5] });
            docDefinition.content.push({
                table: {
                    widths: ['*', '*'],
                    body: [
                        [{ text: 'Тип источника', style: 'tableHeader' }, { text: 'Координаты', style: 'tableHeader' }],
                        [{ text: src.category || '-', style: 'tableBody' }, { text: src.lat ? `${src.lat}, ${src.lng}` : 'Не заданы', style: 'tableBody' }]
                    ]
                }
            });

            // Table 2: Input parameters
            if (src.inputs) {
                docDefinition.content.push({ text: 'Таблица 2. Исходные данные для расчета (включая коэффициенты)', style: 'text', bold: true, margin: [0,10,0,5] });
                const paramBody = [[{ text: 'Параметр', style: 'tableHeader' }, { text: 'Значение', style: 'tableHeader' }]];
                for (const [k, v] of Object.entries(src.inputs)) {
                    if (k.endsWith('_trace') || k.endsWith('_override')) continue;
                    paramBody.push([{ text: k, style: 'tableBody' }, { text: String(v), style: 'tableBody' }]);
                }
                docDefinition.content.push({ table: { widths: ['*', '*'], body: paramBody } });
            }

            // Table 3: Calculation Steps
            if (src.results && src.results.calculation_steps) {
                docDefinition.content.push({ text: 'Таблица 3. Последовательность вычислений', style: 'text', bold: true, margin: [0,10,0,5] });
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
                docDefinition.content.push({ table: { widths: ['auto', '*', '*', 'auto'], body: calcBody } });
            }

            // Table 4: Composition
            if (src.composition && src.composition.length > 0) {
                docDefinition.content.push({ text: 'Таблица 4. Вещества и расчетные выбросы', style: 'text', bold: true, margin: [0,10,0,5] });
                const compBody = [
                    [{ text: 'Загрязняющее вещество', style: 'tableHeader' }, { text: 'Доля (%)', style: 'tableHeader' }, { text: 'Макс. выброс (г/с)', style: 'tableHeader' }, { text: 'Годовой выброс (т/год)', style: 'tableHeader' }]
                ];
                src.composition.forEach(c => {
                    const m_part = (src.M != null ? src.M : (src.results && src.results.M || 0)) * (c.pct / 100);
                    const g_part = (src.G != null ? src.G : (src.results && src.results.G || 0)) * (c.pct / 100);
                    compBody.push([
                        { text: c.name, style: 'tableBody' },
                        { text: c.pct.toFixed(2), style: 'tableBody', alignment: 'center' },
                        { text: m_part.toFixed(6), style: 'tableBody', alignment: 'right' },
                        { text: g_part.toFixed(6), style: 'tableBody', alignment: 'right' }
                    ]);
                });
                docDefinition.content.push({ table: { widths: ['*', 'auto', 'auto', 'auto'], body: compBody } });
            }
            docDefinition.content.push({ text: '', pageBreak: 'after' });
        }

        // Summary footer
        docDefinition.content.push({ text: 'Сводные данные по проекту', style: 'subheader' });
        let totalM = project.sources.reduce((sum, s) => {
            const val = (s.M != null) ? s.M : (s.results && s.results.M ? s.results.M : 0);
            return sum + val;
        }, 0);
        let totalG = project.sources.reduce((sum, s) => {
            const val = (s.G != null) ? s.G : (s.results && s.results.G ? s.results.G : 0);
            return sum + val;
        }, 0);
        docDefinition.content.push({ text: `Суммарный максимально-разовый выброс: ${totalM.toFixed(6)} г/с\nСуммарный валовый выброс: ${totalG.toFixed(6)} т/год`, style: 'text', bold: true });
        
        docDefinition.content.push({
            style: 'signatureBlock',
            columns: [
                { text: 'Расчет выполнил: ________________________', width: '*' },
                { text: 'Проверил: ________________________', width: '*' }
            ]
        });

        pdfMake.createPdf(docDefinition).download(`Emission_Report_${Date.now()}.pdf`);
    }

    return { generatePDF };
})();
