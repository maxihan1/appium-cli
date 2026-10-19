// 테스트가 같이 쓰는 Android 화면 XML (test_platform runner appScreen.test.ts 와 같은 화면)

export const 화면XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout index="0" package="com.shop" class="android.widget.FrameLayout" text="" clickable="false" enabled="true" scrollable="false" bounds="[0,0][1080,2400]" resource-id="" content-desc="">
    <android.view.ViewGroup index="0" text="" clickable="false" scrollable="false" bounds="[0,0][1080,2400]" resource-id="com.shop:id/root" content-desc="">
      <android.widget.TextView index="0" text="Tom &amp; Jerry &gt; 1" clickable="false" scrollable="false" bounds="[10,20][30,40]" resource-id="" content-desc="" />
      <android.widget.Button index="1" text="" clickable="true" enabled="false" scrollable="false" bounds="[10,50][30,70]" resource-id="" content-desc="로그인 > 시작" />
      <android.widget.EditText index="2" text="••••" password="true" clickable="true" scrollable="false" bounds="[10,80][30,90]" resource-id="com.shop:id/pw" content-desc="" />
    </android.view.ViewGroup>
    <android.view.View index="1" text="" clickable="false" scrollable="false" bounds="[0,0][1,1]" resource-id="" content-desc="" />
  </android.widget.FrameLayout>
</hierarchy>`;
