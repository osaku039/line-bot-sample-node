import { readFileSync } from 'fs';
import { LineApi } from './line-api.mjs';
import { DataStore } from './data-store.mjs';

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const lineApi = new LineApi(CHANNEL_ACCESS_TOKEN);
// const datastore = new DataStore();


class FesLiff {
    async fes(request, response, datastore){
        const authHeader = request.headers.authorization;

        {if (authHeader && authHeader.startsWith('Bearer ')) {
            
        console.log("fes2");
        const template = readFileSync('results.html').toString();
        let html = template.replaceAll("$LIFF_ID", `'${process.env.LIFF_ID}'`);

        const idToken = authHeader.substring(7);
        const verifyResponse = await lineApi.verify(idToken, process.env.CHANNEL_ID);
        if (verifyResponse.status === 200) {
            const userProfile = verifyResponse.data;
            
            const state = await datastore.load_global();
            console.log(state);
            //もしstate['BookLog']が存在すればその値を、存在しなければからの配列をlogsに代入している。
            const logs = state['BookLog'] || [];
            console.log(logs);

            const book1 = "ハリー・ポッターと賢者の石";  // ユーザーの勝利はBOTの負け
            const book2 = "はらぺこあおむし";  // ユーザーの敗北はBOTの勝ち
            console.log("length = " + logs.length)
            html = html.replaceAll('$BOOK1', book1);
            html = html.replaceAll('$BOOK2', book2);
            const entries = logs.filter(entry => entry.bookTitle === book1 || entry.bookTitle === book2);
            console.log(entries);

            await datastore.start_vote();
            const vote = await datastore.load_vote();
            console.log(vote);
            let currentVote;
            if (vote[0] != 0) {
                currentVote = (vote[1] * 100) / vote[0];
            }else {
                currentVote = 50;
            }
            console.log(currentVote);
            html = html.replace('$GRAPH', 
                `<div class="h-6 p-0.5 leading-none border-r-2 text-white text-s rounded-full rounded-tr-none rounded-br-none" style="background-color: #2e7b51; border-color: #fff5e2; width: ${currentVote}%">
                ${currentVote}%
                </div>`
            );

            html = html.replace('$RATE', 
                `<div class="p-0.1 text-white text-s">
                ${100-currentVote}%
                </div>`
            );

            


            if (entries.length >= 0) {
            html = html.replace(
                '$LOGS',
                entries.map((result => {
                    const Color= result.bookTitle === book1 ? "#2e7b51" : "#f2c46c";
                    const linkStart = result.bookUrl !== "" ? `<a href="${result.bookUrl}" target="_blank" rel="noopener noreferrer">` : '';
                    const linkEnd = result.bookUrl !== "" ? `</a>` : '';
                    return `
                        ${linkStart}
                        <div style="border-color: ${Color}"class="rounded-lg border-4 shadow-2xl">
                        <div
                        class="flex flex-row rounded-lg bg-white text-surface shadow-secondary-1 dark:bg-surface-dark dark:text-white md:max-w-xl md:flex-row">
                        <div class=" w-32 h-full p-4">
                        <img
                        class="w-50 h-100 rounded-lg"
                        src=${result.bookCover}
                        alt="" />
                        </div>
                        <div class="flex flex-col justify-start p-6 flex-grow">
                        <h5 style="color: ${Color}" class="mb-2 text-xl font-normal">${result.bookTitle}</h5>
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
            console.log("fes1");
            let html = template
                .replaceAll("$LIFF_ID", `'${process.env.LIFF_ID}'`)
                .replaceAll("$SEND", `'/fes'`)
                .replaceAll("$TITLE", `Fes`);


            response.status(200).send(html);
        }
    };}
}

export {
    FesLiff
}
