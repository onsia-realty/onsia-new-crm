/**
 * OCR 서비스 - 이미지에서 전화번호, 날짜, 주소 자동 추출
 * Naver CLOVA OCR + Tesseract OCR
 */

import axios from 'axios';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

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
   * 이미지를 Buffer로 읽기 (원본 그대로 사용)
   */
  async readImageAsBuffer(imagePath: string): Promise<Buffer> {
    // 원본 이미지를 그대로 Buffer로 변환
    return await sharp(imagePath).toBuffer();
  }

  /**
   * Tesseract OCR로 텍스트 추출 (원본 이미지 사용)
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      await this.initWorker();
      if (!this.worker) {
        throw new Error('Tesseract worker failed to initialize');
      }
      // 원본 이미지 그대로 사용
      const {
        data: { text },
      } = await this.worker.recognize(imagePath);
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
      // 원본 이미지를 base64로 변환 (전처리 없이 그대로 사용)
      console.log('📸 원본 이미지로 OCR 처리 중...');
      const imageBuffer = await this.readImageAsBuffer(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // 이미지 확장자 확인
      const imageExt = imagePath.toLowerCase().split('.').pop() || 'jpg';
      const imageFormat = ['png', 'jpg', 'jpeg'].includes(imageExt) ? imageExt : 'jpg';

      // CLOVA OCR API 호출 (원본 이미지)
      const response = await axios.post(
        this.clovaConfig.invokeUrl,
        {
          images: [
            {
              format: imageFormat,
              name: 'original_image',
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

      // 이미지 타입 감지
      const imageType = this.detectImageType(fullText);

      // 패턴 매칭으로 정보 추출 (타입별 특화 전략 적용)
      return {
        phoneNumber: this.extractPhoneNumber(fullText, imageType),
        time: this.extractTime(fullText),
        date: this.extractDate(fullText),
        address: this.extractAddress(fullText, imageType),
        rawText: fullText,
      };
    } catch (error: unknown) {
      console.error('❌ CLOVA OCR 처리 실패:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 이미지 타입 감지 (Timemark vs Timestamp vs 기타)
   */
  detectImageType(text: string): 'timemark' | 'timestamp' | 'generic' {
    const lowerText = text.toLowerCase();

    // Timemark 앱 감지
    if (lowerText.includes('timemark') || lowerText.includes('타임마크')) {
      console.log('🔍 타임마크 앱 이미지 감지');
      return 'timemark';
    }

    // Timestamp 앱 감지 (요일 포함 날짜 형식 + 오전/오후)
    if ((lowerText.includes('timestamp') || lowerText.includes('타임스탬프')) ||
        (text.includes('년') && text.includes('월') && text.includes('일') && text.match(/\([가-힣]\)/))) {
      console.log('🔍 타임스탬프 앱 이미지 감지');
      return 'timestamp';
    }

    console.log('🔍 일반 이미지로 처리');
    return 'generic';
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
   * 전화번호 추출 - Multi-Strategy (타입별 특화 패턴)
   */
  extractPhoneNumber(text: string, imageType: 'timemark' | 'timestamp' | 'generic' = 'generic'): string | null {
    const cleanedText = this.cleanText(text);

    // 전략 1: 타임마크 특화 (세로 배치 대응 - 우선 시도)
    if (imageType === 'timemark') {
      const digits = text.replace(/\D/g, '');
      const elevenDigitPattern = /010(\d{8})/;
      const match = digits.match(elevenDigitPattern);

      if (match && match[0].length === 11) {
        const phone = match[0];
        console.log('✅ 타임마크 특화: 전화번호 추출 성공', phone);
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }
    }

    // 전략 2: 타임스탬프 특화 (일반 패턴 우선)
    if (imageType === 'timestamp') {
      const timestampPattern = /010[-\s]?\d{4}[-\s]?\d{4}/;
      const match = cleanedText.match(timestampPattern);
      if (match) {
        const phone = match[0].replace(/\D/g, '');
        console.log('✅ 타임스탬프 특화: 전화번호 추출 성공', phone);
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }
    }

    // 전략 3: 일반 패턴 (다양한 형식 시도)
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

    const validNumbers = allMatches.filter((num) => {
      const digits = num.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    });

    if (validNumbers.length > 0) {
      const phone = validNumbers[0].replace(/\D/g, '');
      if (phone.length === 11 && phone.startsWith('010')) {
        console.log('✅ 일반 패턴: 전화번호 추출 성공', phone);
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      } else if (phone.length === 10) {
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      } else if (phone.length === 11) {
        return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return phone;
    }

    // 폴백: 모든 숫자에서 010 패턴 찾기
    const digits = text.replace(/\D/g, '');
    const elevenDigitPattern = /010(\d{8})/;
    const match = digits.match(elevenDigitPattern);

    if (match && match[0].length === 11) {
      const phone = match[0];
      console.log('⚠️ 폴백: 전화번호 추출 성공', phone);
      return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }

    console.log('❌ 전화번호 추출 실패');
    return null;
  }

  /**
   * 시간 추출
   */
  extractTime(text: string): string | null {
    const patterns = [
      // 타임스탬프 앱: "오전 11:09", "오후 02:30"
      /(오전|오후)\s*([0-1]?[0-9]):([0-5][0-9])/g,
      // 기본 시간 형식
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
   * 주소 추출 - Multi-Strategy (타입별 특화 패턴)
   */
  extractAddress(text: string, imageType: 'timemark' | 'timestamp' | 'generic' = 'generic'): string | null {
    // 앱 키워드 제거
    const cleanedText = text
      .replace(/Timemark/gi, '')
      .replace(/Timestamp/gi, '')
      .replace(/TIME\s*STAMP/gi, '')
      .replace(/타임마크\s*카메라/g, '')
      .replace(/타임마크/g, '')
      .replace(/타임스탬프/g, '')
      .replace(/카메라/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 전략 1: 타임마크 특화 (역순 대응 - 우선 시도)
    if (imageType === 'timemark') {
      // 타임마크는 주소가 역순으로 나올 수 있음
      if (cleanedText.includes('대한민국') && cleanedText.indexOf('대한민국') > cleanedText.indexOf('로')) {
        const roadMatch = cleanedText.match(/([가-힣]+(?:로|길)\s*\d+)/);
        const guMatch = cleanedText.match(/([가-힣]+[군구])/);
        const siMatch = cleanedText.match(/([가-힣]+시)/);
        const doMatch = cleanedText.match(/([가-힣]+도)/);

        if (roadMatch && guMatch && siMatch && doMatch) {
          const address = `대한민국 ${doMatch[1]} ${siMatch[1]} ${guMatch[1]} ${roadMatch[1]}`.replace(/\s+/g, ' ');
          console.log('✅ 타임마크 특화: 역순 주소 재구성 성공', address);
          return address;
        }
      }
    }

    // 전략 2: 타임스탬프 특화 (정순 우선)
    if (imageType === 'timestamp') {
      // 타임스탬프는 정순으로 나옴
      const timestampPattern = /(대한민국\s+[가-힣]+[시도]\s+[가-힣]+[시군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/;
      const match = cleanedText.match(timestampPattern);
      if (match) {
        console.log('✅ 타임스탬프 특화: 정순 주소 추출 성공', match[0]);
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }

    // 전략 3: 일반 역순 처리 (타입 무관)
    if (cleanedText.includes('대한민국') && cleanedText.indexOf('대한민국') > cleanedText.indexOf('로')) {
      const roadMatch = cleanedText.match(/([가-힣]+(?:로|길)\s*\d+)/);
      const guMatch = cleanedText.match(/([가-힣]+[군구])/);
      const siMatch = cleanedText.match(/([가-힣]+시)/);
      const doMatch = cleanedText.match(/([가-힣]+도)/);

      if (roadMatch && guMatch && siMatch && doMatch) {
        const address = `대한민국 ${doMatch[1]} ${siMatch[1]} ${guMatch[1]} ${roadMatch[1]}`.replace(/\s+/g, ' ');
        console.log('✅ 일반 패턴: 역순 주소 재구성 성공', address);
        return address;
      }
    }

    // 정상 순서 패턴 매칭
    const patterns = [
      // 도로명 주소 패턴
      /(대한민국\s+[가-힣]+[시도]\s+[가-힣]+[시군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /(\d{5})\s*([가-힣]+\s*[시도군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣]+[시도]\s+[가-힣]+[군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣]+[군구]\s+[가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,
      /([가-힣\s]+(?:로|길)\s*\d+[-\d]*)/,

      // 지번 주소 패턴 (동/읍/면 + 번지)
      /(대한민국\s+[가-힣]+시\s+[가-힣]+[동읍면리]\s+\d+[-\d]*)/,
      /([가-힣]+시\s+[가-힣]+[동읍면리]\s+\d+[-\d]*)/,
      /([가-힣]+[군구]\s+[가-힣]+[동읍면리]\s+\d+[-\d]*)/,
      /([가-힣]+[동읍면리]\s+\d+[-\d]*)/,
    ];

    for (const pattern of patterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        console.log('✅ 일반 패턴: 주소 추출 성공', match[0]);
        return match[0].replace(/\s+/g, ' ').trim();
      }
    }

    // 폴백: 키워드 기반 검색
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
          const address = extractedText.substring(startIndex, endIndex).trim();
          console.log('⚠️ 폴백: 키워드 기반 주소 추출', address);
          return address;
        }
      }
    }

    console.log('❌ 주소 추출 실패');
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
      // 타임스탬프 앱: "2025년 11월 4일 (화)" - 요일 제거 필요
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*\([가-힣]\)/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      /\d{2}\/\d{2}\/\d{4}/g,
      /\d{4}[-/.]\d{2}[-/.]\d{2}/g,
      /\d{2}[-/.]\d{2}[-/.]\d{4}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // 요일 부분 제거 (타임스탬프 앱)
        const dateStr = matches[0].replace(/\s*\([가-힣]\)/, '');
        return this.normalizeDate(dateStr);
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

      // 이미지 타입 감지 (폴백용)
      const fullText = visionData?.rawText || fallbackText;
      const imageType = this.detectImageType(fullText);

      // 최종 데이터 결정 (타입별 특화 전략 적용)
      const phoneNumber = visionData?.phoneNumber || (fallbackText ? this.extractPhoneNumber(fallbackText, imageType) : null);
      const time = visionData?.time || (fallbackText ? this.extractTime(fallbackText) : null);
      const address = visionData?.address || (fallbackText ? this.extractAddress(fallbackText, imageType) : null);
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
