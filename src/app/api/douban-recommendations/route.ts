import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

interface DoubanRecommendation {
  doubanId: string;
  title: string;
  poster: string;
  rating: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const doubanId = searchParams.get('id');

  if (!doubanId) {
    return NextResponse.json({ error: 'Missing douban ID' }, { status: 400 });
  }

  try {
    // 请求豆瓣电影页面，使用和其他豆瓣API相同的请求头
    const url = `https://movie.douban.com/subject/${doubanId}/`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Referer: 'https://movie.douban.com/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Origin: 'https://movie.douban.com',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch douban page' },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const recommendations: DoubanRecommendation[] = [];

    console.log('开始解析豆瓣推荐');

    // 解析推荐模块
    $('.recommendations-bd dl').each((index, element) => {
      const $dl = $(element);

      // 提取链接和豆瓣ID
      const $link = $dl.find('dt a');
      const href = $link.attr('href') || '';
      const doubanIdMatch = href.match(/subject\/(\d+)/);
      const recDoubanId = doubanIdMatch ? doubanIdMatch[1] : '';

      // 提取图片 - 返回原始豆瓣URL，由客户端processImageUrl根据配置处理
      const poster = $link.find('img').attr('src') || '';

      // 提取标题
      const title = $dl.find('dd a').first().text().trim();

      // 提取评分
      const rating = $dl.find('dd .subject-rate').text().trim();

      if (recDoubanId && title) {
        recommendations.push({
          doubanId: recDoubanId,
          title,
          poster,
          rating,
        });
      }
    });

    console.log('解析到推荐数:', recommendations.length);

    return NextResponse.json(
      {
        recommendations,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (error) {
    console.error('Douban recommendations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to parse douban recommendations' },
      { status: 500 }
    );
  }
}
