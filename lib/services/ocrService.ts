/**
 * OCR 서비스 - 이미지에서 전화번호, 날짜, 주소 자동 추출
 * Naver CLOVA OCR + Tesseract OCR
 */

import axios from 'axios';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

export interface OCRResult {
  success: boolean;
  data?: {
    phoneNumber: string | null;
    time: string | null;
    address: string | null;
    date: string | null;
    dayOfWeek: string | null;
    rawText: string;
    method: string;
    aiEnhanced: boolean;
    timestamp: string;
    imagePath: string;
  };
  error?: string;
  message?: string;
}

interface ClovaConfig {
  secretKey: string;
  invokeUrl: string;
}

export class ImageOCRExtractor {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  private clovaConfig: ClovaConfig | null = null;

  constructor() {
    // Naver CLOVA OCR 초기화
    if (process.env.CLOVA_OCR_SECRET && process.env.CLOVA_OCR_URL) {
      this.clovaConfig = {
        secretKey: process.env.CLOVA_OCR_SECRET,
        invokeUrl: process.env.CLOVA_OCR_URL,
      };
      console.log('✅ Naver CLOVA OCR 초기화 완료');
    } else {
      console.warn('⚠️ CLOVA_OCR_SECRET 또는 CLOVA_OCR_URL이 설정되지 않았습니다.');
      this.clovaConfig = null;
    }
  }

  /**
   * OCR 워커 초기화
   */
  async initWorker(): Promise<void> {
    if (!this.worker) {
      this.worker = await createWorker('kor+eng');
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z -/:,.',
      });
    }
  }

  /**
   * 이미지 전처리 (Tesseract용)
   */
  async preprocessImage(imagePath: string): Promise<Buffer> {
    return await sharp(imagePath)
      .resize({ width: 3000 })
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(128)
      .toBuffer();
  }

  /**
   * Tesseract OCR로 텍스트 추출
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      await this.initWorker();
      const preprocessed = await this.preprocessImage(imagePath);
      const {
        data: { text },
      } = await this.worker.recognize(preprocessed);
      return text;
    } catch (error: unknown) {
      console.error('Tesseract OCR 실패:', error);
      throw error;
    }
  }

  /**
   * Naver CLOVA OCR로 이미지 분석
   */
  async analyzeImageWithClova(
    imagePath: string
  ): Promise<{ phoneNumber: string | null; time: string | null; date: string | null; address: string | null; rawText: string }> {
    if (!this.clovaConfig) {
      throw new Error('Naver CLOVA OCR이 초기화되지 않았습니다.');
    }

    try {
      // 이미지를 base64로 읽기
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // CLOVA OCR API 호출
      const response = await axios.post(
        this.clovaConfig.invokeUrl,
        {
          images: [
            {
              format: path.extname(imagePath).substring(1).toLowerCase(),
              name: 'car_order_image',
              data: base64Image,
            },
          ],
          requestId: `ocr-${Date.now()}`,
          version: 'V2',
          timestamp: Date.now(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-OCR-SECRET': this.clovaConfig.secretKey,
          },
        }
      );

      console.log('🔍 CLOVA OCR 응답 받음');

      // 응답에서 텍스트 추출
      const extractedTexts: string[] = [];
      if (response.data && response.data.images && response.data.images[0]) {
        const fields = response.data.images[0].fields;
        if (fields) {
          fields.forEach((field: { inferText?: string }) => {
            if (field.inferText) {
              extractedTexts.push(field.inferText);
            }
          });
        }
      }

      const fullText = extractedTexts.join(' ');
      console.log('📝 CLOVA 추출 텍스트:', fullText);

      // 패턴 매칭으로 정보 추출
      return {
        phoneNumber: this.extractPhoneNumber(fullText),
        time: this.extractTime(fullText),
        date: this.extractDate(fullText),
        address: this.extractAddress(fullText),
        rawText: fullText,
      };
    } catch (error: unknown) {
      console.error('❌ CLOVA OCR 처리 실패:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 텍스트 정리 - OCR 노이즈 제거
   */
  cleanText(text: string): string {
    return text
      .replace(/[|\\\/~`^*_+=<>{}[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 전화번호 추출
   */
  extractPhoneNumber(text: string): string | null {
    const cleanedText = this.cleanText(text);

    // 다양한 전화번호 패턴 매칭
    const patterns = [
      /010[-\s]?\d{4}[-\s]?\d{4}/g,
      /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g,
      /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g,
      /\d{3}[-.\s]?\d{4}[-.\s]?\d{4}/g,
      /\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    ];

    const allMatches: string[] = [];
    for (const pattern of patterns) {
      const matches = cleanedText.match(pattern);
      if (matches) {
        allMatches.push(...matches);
      }
    }

    // 가장 확실한 전화번호 필터링
    const validNumbers = allMatches.filter((num) => {
      const digits = num.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    });

    if (validNumbers.length > 0) {
      const phone = validNumbers[0].replace(/\D/g, '');
      if (phone.length === 11 && phone.startsWith('010')) {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      } else if (phone.length === 10) {
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      } else if (phone.length === 11) {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return phone;
    }

    // CLOVA OCR이 세로 텍스트를 띄어쓰기로 분리한 경우 처리
    const digits = text.replace(/\D/g, '');

    // 11자리 연속 숫자 중 010으로 시작하는 부분 찾기
    const elevenDigitPattern = /010(\d{8})/;
    const match = digits.match(elevenDigitPattern);

    if (match && match[0].length === 11) {
      const phone = match[0];
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }

    return null;
  }

  /**
   * 시간 추출
   */
  extractTime(text: string): string | null {
    const patterns = [
      /([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])/g,
      /([0-1]?[0-9]|2[0-3]):([0-5][0-9])/g,
      /([0-1]?[0-9]|2[0-3])시\s*([0-5][0-9])분/g,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.length > 0) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * 주소 추출
   */
  extractAddress(text: string): string | null {
    // Timemark 앱 관련 텍스트 제거
    const cleanedText = text
      .replace(/Timemark/gi, '')
      .replace(/타임마크\s*카메라/g, '')
      .replace(/타임마크/g, '')
      .replace(/카메라/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // CLOVA OCR이 역순으로 추출하는 경우 처리
    if (cleanedText.includes('대한민국') && cleanedText.indexOf('대한민국') > cleanedText.indexOf('로')) {
      const roadMatch = cleanedText.match(/([가-힣]+(?:로|길)\s*\d+)/);
      const guMatch = cleanedText.match(/([가-힣]+[군구])/);
      const siMatch = cleanedText.match(/([가-힣]+시)/);
      const doMatch = cleanedText.match(/([가-힣]+도)/);

      if (roadMatch && guMatch && siMatch && doMatch) {
        return `대한민국 ${doMatch[1]} ${siMatch[1]} ${guMatch[1]} ${roadMatch[1]}`.replace(/\s+/g, ' ');
      }
    }

    // 정상 순서 패턴 매칭
    const patterns = [
      /(대한민국\s+[가-힣]+[시도]\s+[가-힣]+[시군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /(\d{5})\s*([가-힣]+\s*[시도군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣]+[시도]\s+[가-힣]+[군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣]+[군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
    ];

    for (const pattern of patterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }

    // 키워드 기반 검색
    const addressKeywords = ['대한민국', '경기도', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '처인구', '수지구', '기흥구'];

    for (const keyword of addressKeywords) {
      if (cleanedText.includes(keyword)) {
        const index = cleanedText.indexOf(keyword);
        const extractedText = cleanedText.substring(index, Math.min(cleanedText.length, index + 150));

        const zipMatch = extractedText.match(/\d{5}/);
        const roadMatch = extractedText.match(/[가-힣\s]+(?:로|길)\s*\d+/);

        if (roadMatch) {
          const startIndex = extractedText.indexOf(zipMatch ? zipMatch[0] : keyword);
          const endIndex = extractedText.indexOf(roadMatch[0]) + roadMatch[0].length;
          return extractedText.substring(startIndex, endIndex).trim();
        }
      }
    }

    return null;
  }

  /**
   * 날짜에서 요일 자동 계산
   */
  calculateDayOfWeek(dateString: string): string | null {
    if (!dateString) return null;

    try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return null;

      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      const date = new Date(year, month - 1, day);

      if (isNaN(date.getTime())) return null;

      const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      const dayIndex = date.getDay();

      return days[dayIndex];
    } catch (error) {
      console.error('요일 계산 실패:', error);
      return null;
    }
  }

  /**
   * 날짜 추출
   */
  extractDate(text: string): string | null {
    const patterns = [
      /\d{2}\/\d{2}\/\d{4}/g,
      /\d{4}[-/.]\d{2}[-/.]\d{2}/g,
      /\d{2}[-/.]\d{2}[-/.]\d{4}/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        return this.normalizeDate(matches[0]);
      }
    }

    return null;
  }

  /**
   * 날짜 정규화 (Timemark 포맷: DD/MM/YYYY → MM-DD-YYYY)
   */
  normalizeDate(dateStr: string): string {
    dateStr = dateStr.replace(/[년월]/g, '-').replace(/일/g, '');

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD/MM/YYYY -> MM-DD-YYYY
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${month}-${day}-${year}`;
        } else if (parts[0].length === 4) {
          // YYYY/MM/DD -> MM-DD-YYYY
          return `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}-${parts[0]}`;
        }
      }
    }

    // YYYY-MM-DD -> MM-DD-YYYY 변환
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateStr.split('-');
      return `${parts[1]}-${parts[2]}-${parts[0]}`;
    }

    return dateStr;
  }

  /**
   * 이미지에서 모든 정보 추출 (Naver CLOVA 우선)
   */
  async extractAllData(imagePath: string): Promise<OCRResult> {
    try {
      let visionData: { phoneNumber: string | null; time: string | null; date: string | null; address: string | null; rawText: string } | null = null;
      let fallbackText = '';
      let methodUsed = '';

      // 1. Naver CLOVA OCR로 이미지 분석 시도
      if (this.clovaConfig) {
        try {
          console.log('🔍 Naver CLOVA OCR로 이미지 분석 중...');
          visionData = await this.analyzeImageWithClova(imagePath);
          console.log('✅ CLOVA OCR 결과:', visionData);
          methodUsed = 'Naver CLOVA OCR';
        } catch (clovaError: unknown) {
          console.warn('⚠️ CLOVA OCR 실패, 다음 방법 시도:', clovaError instanceof Error ? clovaError.message : 'Unknown error');
        }
      }

      // 2. Vision 실패 시 Tesseract OCR 폴백
      if (!visionData || (!visionData.phoneNumber && !visionData.date)) {
        console.log('📝 Tesseract OCR로 텍스트 추출 중...');
        fallbackText = await this.extractTextFromImage(imagePath);
        console.log('OCR 텍스트:', fallbackText);
        if (!methodUsed) {
          methodUsed = 'Tesseract OCR + Pattern Matching';
        }
      }

      // 최종 데이터 결정
      const phoneNumber = visionData?.phoneNumber || (fallbackText ? this.extractPhoneNumber(fallbackText) : null);
      const time = visionData?.time || (fallbackText ? this.extractTime(fallbackText) : null);
      const address = visionData?.address || (fallbackText ? this.extractAddress(fallbackText) : null);
      const date = visionData?.date || (fallbackText ? this.extractDate(fallbackText) : null);

      // 요일은 날짜로부터 자동 계산
      const dayOfWeek = date ? this.calculateDayOfWeek(date) : null;

      return {
        success: true,
        data: {
          phoneNumber,
          time,
          address,
          date,
          dayOfWeek,
          rawText: fallbackText || '(AI Vision으로 직접 분석)',
          method: methodUsed,
          aiEnhanced: visionData !== null,
          timestamp: new Date().toISOString(),
          imagePath: imagePath,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 워커 정리
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
