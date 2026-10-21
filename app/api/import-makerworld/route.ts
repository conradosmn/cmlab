import { NextResponse } from "next/server";

async function fetchImageAsDataUrl(imgUrl: string): Promise<string> {
  try {
    const res = await fetch(imgUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://makerworld.com/",
      },
    });
    if (!res.ok) return imgUrl;
    const contentType = res.headers.get("content-type") || "image/webp";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return imgUrl;
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Informe uma URL válida do MakerWorld." },
        { status: 400 }
      );
    }

    // 1ª Tentativa: Leitura direta do __NEXT_DATA__ do MakerWorld
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      const html = await response.text();
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );

      if (match && match[1]) {
        const nextData = JSON.parse(match[1]);
        const design = nextData?.props?.pageProps?.design;
        if (design) {
          const instances = design.instances || [];
          const a1Instance =
            instances.find((inst: any) => {
              const title = (inst.title || "").toLowerCase();
              const compat = JSON.stringify(
                inst.extention?.modelInfo?.compatibility || ""
              ).toLowerCase();
              const mentionsA1 =
                /\ba1\b/.test(title) ||
                compat.includes('"a1"') ||
                compat.includes("bambu lab a1");
              const isOnlyMini =
                title.includes("a1 mini") &&
                !title.replace("a1 mini", "").includes("a1");
              return mentionsA1 && !isOnlyMini;
            }) ||
            instances.find(
              (inst: any) => !(inst.title || "").toLowerCase().includes("mini")
            ) ||
            instances[0] ||
            {};

          const ext = a1Instance.extention?.modelInfo || {};
          const rawImages: string[] = (
            design.designExtension?.design_pictures || []
          )
            .map((pic: any) => pic.url)
            .filter(Boolean)
            .slice(0, 5);

          // Converte as fotos do CDN do MakerWorld para DataURL p/ evitar bloqueio de hotlink (403)
          const images = await Promise.all(rawImages.map(fetchImageAsDataUrl));

          const weightGrams = Math.ceil(a1Instance.weight || ext.weight || 0);
          const predictionSeconds =
            a1Instance.prediction || ext.prediction || 0;
          const printTimeMinutes = Math.ceil(predictionSeconds / 60);

          const filamentsMap = new Map();
          for (const plate of ext.plates || []) {
            for (const fil of plate.filaments || []) {
              const key = `${fil.type}-${fil.color}`;
              const prevGrams = filamentsMap.get(key)?.usedGrams || 0;
              filamentsMap.set(key, {
                material: fil.type || "PLA",
                hexColor: fil.color || "#FFFFFF",
                usedGrams: Math.ceil(prevGrams + parseFloat(fil.usedG || "0")),
              });
            }
          }

          return NextResponse.json({
            title: design.title,
            profile_name: a1Instance.title || "Perfil Padrão A1",
            makerworld_url: url,
            images,
            weight_grams: weightGrams || 120,
            print_time_minutes: printTimeMinutes || 180,
            required_filaments: Array.from(filamentsMap.values()),
          });
        }
      }
    } catch {
      // Continua para os fallbacks headless abaixo
    }

    // 2ª Tentativa (Bypass Cloudflare): Jina Reader + Microlink Headless
    const [jinaRes, microlinkRes] = await Promise.allSettled([
      fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`),
    ]);

    let extractedTitle = "";
    const extractedImageUrls: string[] = [];
    let weightGrams = 0;
    let printTimeMinutes = 0;

    if (microlinkRes.status === "fulfilled" && microlinkRes.value.ok) {
      const mlJson = await microlinkRes.value.json();
      if (mlJson?.data?.title) {
        extractedTitle = mlJson.data.title
          .replace(/\s*-\s*Free 3D Print Model.*$/i, "")
          .replace(/\s*\|\s*MakerWorld.*$/i, "")
          .trim();
      }
      if (mlJson?.data?.image?.url) {
        extractedImageUrls.push(mlJson.data.image.url);
      }
    }

    if (jinaRes.status === "fulfilled" && jinaRes.value.ok) {
      const jinaJson = await jinaRes.value.json();
      const content: string = jinaJson?.data?.content || "";
      if (!extractedTitle && jinaJson?.data?.title) {
        extractedTitle = jinaJson.data.title
          .replace(/\s*-\s*Free 3D Print Model.*$/i, "")
          .replace(/\s*\|\s*MakerWorld.*$/i, "")
          .trim();
      }

      // Extrai URLs de fotos reais de design_pictures do CDN do MakerWorld
      const imgRegex =
        /https:\/\/makerworld\.bblmw\.com\/makerworld\/model\/[^\s)"']+\.(?:webp|png|jpg|jpeg)[^\s)"']*/gi;
      const matches = content.match(imgRegex) || [];
      for (const mUrl of matches) {
        if (
          !mUrl.includes("avatar") &&
          !mUrl.includes("logo") &&
          !extractedImageUrls.includes(mUrl)
        ) {
          extractedImageUrls.push(mUrl);
        }
        if (extractedImageUrls.length >= 5) break;
      }

      // Tenta extrair peso (ex: "145 g" ou "145g") e tempo (ex: "3.5 h" ou "2 h 30 min")
      const weightMatch = content.match(/(\d+(?:\.\d+)?)\s*g\b/i);
      if (weightMatch?.[1]) {
        weightGrams = Math.ceil(parseFloat(weightMatch[1]));
      }
      const hourMatch = content.match(/(\d+(?:\.\d+)?)\s*h\b/i);
      if (hourMatch?.[1]) {
        printTimeMinutes = Math.ceil(parseFloat(hourMatch[1]) * 60);
      }
    }

    if (extractedTitle || extractedImageUrls.length > 0) {
      const proxiedImages = await Promise.all(
        extractedImageUrls.slice(0, 5).map(fetchImageAsDataUrl)
      );

      return NextResponse.json({
        title:
          extractedTitle ||
          url
            .split("/")
            .pop()
            ?.replace(/^\d+-/, "")
            .replace(/-/g, " ") ||
          "Modelo MakerWorld A1",
        profile_name: "Perfil Bambu Lab A1 (Extraído via Link)",
        makerworld_url: url,
        images: proxiedImages,
        weight_grams: weightGrams || 110,
        print_time_minutes: printTimeMinutes || 160,
        required_filaments: [],
      });
    }

    return NextResponse.json(
      {
        error:
          "O Cloudflare do MakerWorld bloqueou a leitura automática deste link. Baixe o arquivo .3mf no MakerWorld e clique em 'Subir Arquivo .3MF' ao lado (ele extrai todas as fotos, cores, peso e tempo direto do arquivo!).",
        cloudflare_blocked: true,
      },
      { status: 422 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
