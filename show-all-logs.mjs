import { readFileSync } from 'fs';
import { LineApi } from './line-api.mjs';

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const lineApi = new LineApi(CHANNEL_ACCESS_TOKEN);

class ShowAllLogsLiff {
    async allLogs(request, response, datastore){
        const authHeader = request.headers.authorization;

        {if (authHeader && authHeader.startsWith('Bearer ')) {
        const template = readFileSync('showlog.html').toString();
        let html = template.replaceAll("$LIFF_ID", `'${process.env.LIFF_ID}'`);

        const idToken = authHeader.substring(7);
        const verifyResponse = await lineApi.verify(idToken, process.env.CHANNEL_ID);
        if (verifyResponse.status === 200) {
            const userProfile = verifyResponse.data;

            html = html.replaceAll('$USER_NAME', "みんな");

            const state = await datastore.load_global();
            console.log(state);
            // //もしstate['BookLog']が存在すればその値を、存在しなければからの配列をlogsに代入している。
            const logs = state['BookLog'] || [];
            
            // console.log(logs);
            html = html.replace('$TOTAL', "");



            if (logs.length >= 0) {
            html = html.replace(
                '$LOGS',
                logs.map((result => {
                const textColor= result.bookUrl === "" ? "text-green-800" : "text-amber-400";
                const boderColor= result.bookUrl === "" ? "border-green-800" : "border-amber-400";
                const resultClass = result.bookUrl === "" ? "text-green-600" : "text-yellow-600";
                const linkStart = result.bookUrl !== "" ? `<a href="${result.bookUrl}" target="_blank" rel="noopener noreferrer">` : '';
                const linkEnd = result.bookUrl !== "" ? `</a>` : '';
                return `
                    ${linkStart}
                    <div class="rounded-xl border-4 ${boderColor}  shadow-2xl">
                    <div
                    class="flex flex-row rounded-lg bg-white text-surface shadow-secondary-1 dark:bg-surface-dark dark:text-white md:max-w-xl md:flex-row">
                    <div class=" w-32 h-full p-4 ry-auto">
                    <img
                    class="w-50 h-100 rounded-lg"
                    src=${result.bookCover}
                    alt="" />
                    </div>
                    <div class="flex flex-col justify-start p-6 flex-grow">
                    <h5 class="mb-2 text-xl font-normal ${textColor}">${result.bookTitle}</h5>
                    <h2> </h2>
                    <p class="text-neutral-700 text-xs text-surface/75 dark:text-neutral-300 font-thin">
                        ${result.createdAt}
                    </p>
                    <p class="text-neutral-700 text-xs text-surface/75 dark:text-neutral-300 font-thin">
                        ${result.bookUrl}
                    </p>
                    <p class="mb-4 text-base font-extralight">
                        感想 :
                    </p>
                    <p class="mb-4 text-base font-extralight">${result.bookImpressions}</p>
                    </div>
                    </div>
                    </div>
                    ${linkEnd}
                `;
                })).join('\n')
            );
            } else {
            html = html.replace('$LOGS', '<p class="text-gray-500">enoughだよー</p>');
            }

            response.status(200).send(html);
        }
        } else {
        const template = readFileSync('loading.html').toString();
        let html = template.replaceAll("$LIFF_ID", `'${process.env.LIFF_ID}'`)
                           .replaceAll("$SEND", `'/showAllLog'`)
                           .replaceAll("$TITLE", `AllLog`);

        response.status(200).send(html);
        }
    };}
}

export {
    ShowAllLogsLiff
}
