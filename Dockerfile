# פריסה בקונטיינר — Fly.io, Render, Railway או שרת משלכם.
# מי שפורס ב-Vercel לא צריך את הקובץ הזה בכלל.

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- תלויות מלאות, לבנייה ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- תלויות פרודקשן בלבד, לזמן ריצה ----------
# כולל את ה-CLI של Prisma על כל עץ התלויות שלו, כי המיגרציות רצות מכאן.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# ---------- בנייה ----------
FROM base AS build
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- הרצה ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# בדיקת החיים של הפלטפורמה מצביעה על /api/health.
CMD ["node", "server.js"]
