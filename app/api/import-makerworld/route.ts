import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Informe uma URL válida do MakerWorld." }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (!match || !match[1]) {
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o JSON diretamente (proteção Cloudflare do MakerWorld). Use o botão de upload do arquivo .3mf fatiado para a Bambu Lab A1 ou um dos modelos de demonstração.",
          cloudflare_blocked: true,
        },
        { status: 422 }
      );
    }

    const nextData = JSON.parse(match[1]);
    const design = nextData?.props?.pageProps?.design;
    if (!design) {
      return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    }

    const instances = design.instances || [];

    // FILTRO EXCLUSIVO PARA BAMBU LAB A1 (Ignora perfis exclusivos 'A1 mini')
    const a1Instance =
      instances.find((inst: any) => {
        const title = (inst.title || "").toLowerCase();
        const compat = JSON.stringify(inst.extention?.modelInfo?.compatibility || "").toLowerCase();
        const mentionsA1 =
          /\ba1\b/.test(title) || compat.includes('"a1"') || compat.includes("bambu lab a1");
        const isOnlyMini =
          title.includes("a1 mini") && !title.replace("a1 mini", "").includes("a1");
        return mentionsA1 && !isOnlyMini;
      }) ||
      instances.find((inst: any) => !(inst.title || "").toLowerCase().includes("mini")) ||
      instances[0] ||
      {};

    const ext = a1Instance.extention?.modelInfo || {};
    const images = (design.designExtension?.design_pictures || [])
      .map((pic: any) => pic.url)
      .slice(0, 5);

    const weightGrams = Math.ceil(a1Instance.weight || ext.weight || 0);
    const predictionSeconds = a1Instance.prediction || ext.prediction || 0;
    const printTimeMinutes = Math.ceil(predictionSeconds / 60);

    // Extrai as cores e materiais exigidos pelo perfil A1 para alimentar a tabela 'filaments'
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
      weight_grams: weightGrams,
      print_time_minutes: printTimeMinutes,
      required_filaments: Array.from(filamentsMap.values()),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
