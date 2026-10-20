import React from "react";

export function BrandLogo({
  size = "md",
  showSubtitle = true,
}: {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
}) {
  const imgSizes = {
    sm: "h-11 w-auto",
    md: "h-14 w-auto",
    lg: "h-20 w-auto",
  }[size];

  const titleSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  }[size];

  return (
    <div className="flex items-center gap-3.5 select-none">
      <div className="relative flex items-center justify-center shrink-0">
        <img
          src="/logo-cm-casa-criativa.png"
          alt="Logo CM Casa Criativa"
          className={`${imgSizes} object-contain mix-blend-multiply drop-shadow-sm`}
        />
      </div>
      <div>
        <div
          className={`${titleSizes} font-serif font-bold text-musgo leading-none tracking-tight`}
        >
          CM Casa Criativa
        </div>
        {showSubtitle && (
          <div className="text-xs text-oliva tracking-widest uppercase mt-1 font-medium">
            Atelier de Decoração & Presentes 3D
          </div>
        )}
      </div>
    </div>
  );
}
