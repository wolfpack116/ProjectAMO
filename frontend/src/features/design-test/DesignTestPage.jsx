import { useState, Component } from 'react'
import {
  FluentProvider, useId,
  Button, CompoundButton, ToggleButton, MenuButton,
  Input, Textarea, Field, Dropdown, Option, Combobox, Select, SearchBox, SpinButton,
  Checkbox, Radio, RadioGroup, Switch, Slider, Rating, RatingDisplay,
  SwatchPicker, ColorSwatch,
  TabList, Tab,
  Accordion, AccordionItem, AccordionHeader, AccordionPanel,
  Card, CardHeader, CardPreview, CardFooter,
  Badge, CounterBadge, PresenceBadge, Avatar, AvatarGroup, AvatarGroupItem, Persona,
  Spinner, ProgressBar, Skeleton, SkeletonItem,
  Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell,
  DataGrid, DataGridHeader, DataGridRow, DataGridHeaderCell, DataGridBody, DataGridCell, createTableColumn,
  Menu, MenuTrigger, MenuList, MenuItem, MenuPopover,
  Popover, PopoverTrigger, PopoverSurface, Tooltip,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions,
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
  TeachingPopover, TeachingPopoverTrigger, TeachingPopoverSurface, TeachingPopoverHeader, TeachingPopoverBody, TeachingPopoverTitle,
  MessageBar, MessageBarBody, MessageBarTitle,
  Toaster, useToastController, Toast, ToastTitle, ToastBody,
  Breadcrumb, BreadcrumbItem, BreadcrumbButton, BreadcrumbDivider,
  Toolbar, ToolbarButton, ToolbarDivider,
  Tree, TreeItem, TreeItemLayout,
  NavDrawer, NavDrawerBody, NavItem, NavCategory, NavCategoryItem, NavSubItem, NavSubItemGroup,
  Tag, TagGroup, TagPicker, TagPickerControl, TagPickerGroup, TagPickerInput, TagPickerList, TagPickerOption,
  Carousel, CarouselSlider, CarouselCard,
  Link, Divider,
  LargeTitle, Title3, Subtitle1, Subtitle2, Body1, Body2, Caption1,
} from '@fluentui/react-components'
import { appLightTheme, appDarkTheme } from '../../shared/theme/fluentTheme.js'

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    return this.state.err
      ? <Caption1 style={{ color: '#c0291f' }}>(이 컴포넌트 렌더 오류: {String(this.state.err.message || this.state.err)})</Caption1>
      : this.props.children
  }
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <Caption1 style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.6, marginBottom: 10 }}>{title}</Caption1>
      <Boundary><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div></Boundary>
    </section>
  )
}

const GRID_ITEMS = [
  { icao: 'RKSS', cat: 'VFR', vis: '9999' },
  { icao: 'RKPC', cat: 'IFR', vis: '2800' },
  { icao: 'RKPK', cat: 'MVFR', vis: '6000' },
]
const GRID_COLS = [
  createTableColumn({ columnId: 'icao', renderHeaderCell: () => '공항', renderCell: (i) => i.icao }),
  createTableColumn({ columnId: 'cat', renderHeaderCell: () => '카테고리', renderCell: (i) => i.cat }),
  createTableColumn({ columnId: 'vis', renderHeaderCell: () => '시정', renderCell: (i) => i.vis }),
]

function Gallery() {
  const [tab, setTab] = useState('one')
  const [drawer, setDrawer] = useState(false)
  const [tags, setTags] = useState(['RKSS'])
  const toasterId = useId('toaster')
  const { dispatchToast } = useToastController(toasterId)
  const tagOptions = ['RKSS', 'RKPC', 'RKPK', 'RKSI']

  return (
    <div style={{ maxWidth: 980 }}>
      <Toaster toasterId={toasterId} />

      <Section title="Typography">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <LargeTitle>Large title 40</LargeTitle>
          <Title3>Title 3 — 비행 전 기상 브리핑</Title3>
          <Subtitle1>Subtitle 1 — 노선 위험 요약</Subtitle1>
          <Subtitle2>Subtitle 2 — 현재 실황</Subtitle2>
          <Body1>Body 1 — 본문 14/20. METAR/TAF 판독 텍스트.</Body1>
          <Body2>Body 2 — 16/22 본문</Body2>
          <Caption1>Caption 1 — 12/16 라벨/보조</Caption1>
        </div>
      </Section>

      <Section title="Button">
        <Button appearance="primary">Primary</Button>
        <Button appearance="secondary">Secondary</Button>
        <Button appearance="outline">Outline</Button>
        <Button appearance="subtle">Subtle</Button>
        <Button appearance="transparent">Transparent</Button>
        <Button disabled>Disabled</Button>
        <Button shape="circular" appearance="primary">Circular</Button>
        <ToggleButton>Toggle</ToggleButton>
        <CompoundButton secondaryContent="보조 설명">Compound</CompoundButton>
        <MenuButton>MenuButton</MenuButton>
      </Section>

      <Section title="Inputs">
        <Field label="공항"><Input placeholder="RKSS" /></Field>
        <Field label="검색"><SearchBox placeholder="항로 검색" /></Field>
        <Field label="순항고도(FL)"><SpinButton defaultValue={160} step={10} /></Field>
        <Field label="규칙"><Dropdown placeholder="선택"><Option>IFR</Option><Option>VFR</Option></Dropdown></Field>
        <Field label="교체공항"><Combobox placeholder="검색"><Option>RKPK</Option><Option>RKPC</Option></Combobox></Field>
        <Field label="모델"><Select><option>KIM</option><option>UM</option><option>ECMWF</option></Select></Field>
        <Field label="비고"><Textarea placeholder="메모" /></Field>
      </Section>

      <Section title="Tag picker">
        <div style={{ width: 360 }}>
          <TagPicker
            selectedOptions={tags}
            onOptionSelect={(_, d) => setTags(d.selectedOptions)}
          >
            <TagPickerControl>
              <TagPickerGroup>
                {tags.map((t) => <Tag key={t} value={t}>{t}</Tag>)}
              </TagPickerGroup>
              <TagPickerInput aria-label="공항 선택" />
            </TagPickerControl>
            <TagPickerList>
              {tagOptions.filter((o) => !tags.includes(o)).map((o) => (
                <TagPickerOption value={o} key={o}>{o}</TagPickerOption>
              ))}
            </TagPickerList>
          </TagPicker>
        </div>
      </Section>

      <Section title="Selection · Rating">
        <Switch label="레이더" defaultChecked /><Switch label="착빙" />
        <Checkbox label="난류" defaultChecked /><Checkbox label="바람" />
        <RadioGroup layout="horizontal" defaultValue="ifr"><Radio value="ifr" label="IFR" /><Radio value="vfr" label="VFR" /></RadioGroup>
        <div style={{ width: 200 }}><Slider defaultValue={50} /></div>
        <Rating defaultValue={3} />
        <RatingDisplay value={4} count={128} />
      </Section>

      <Section title="Swatch picker">
        <SwatchPicker defaultSelectedValue="ifr">
          <ColorSwatch color="#166534" value="vfr" aria-label="VFR" />
          <ColorSwatch color="#1d4ed8" value="mvfr" aria-label="MVFR" />
          <ColorSwatch color="#c0291f" value="ifr" aria-label="IFR" />
          <ColorSwatch color="#9d2c9d" value="lifr" aria-label="LIFR" />
        </SwatchPicker>
      </Section>

      <Section title="Tabs · Breadcrumb · Toolbar · Nav">
        <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value)}>
          <Tab value="one">현재</Tab><Tab value="two">노선</Tab><Tab value="three">목적지</Tab>
        </TabList>
        <Breadcrumb>
          <BreadcrumbItem><BreadcrumbButton>지도</BreadcrumbButton></BreadcrumbItem>
          <BreadcrumbDivider />
          <BreadcrumbItem><BreadcrumbButton current>브리핑</BreadcrumbButton></BreadcrumbItem>
        </Breadcrumb>
        <Toolbar>
          <ToolbarButton>레이어</ToolbarButton><ToolbarDivider /><ToolbarButton>측정</ToolbarButton><ToolbarButton>초기화</ToolbarButton>
        </Toolbar>
        <NavDrawer open type="inline" style={{ height: 220, minWidth: 200 }}>
          <NavDrawerBody>
            <NavItem value="1">지도</NavItem>
            <NavItem value="2">브리핑</NavItem>
            <NavCategory value="wx">
              <NavCategoryItem>기상</NavCategoryItem>
              <NavSubItemGroup>
                <NavSubItem value="3">레이더</NavSubItem>
                <NavSubItem value="4">착빙</NavSubItem>
              </NavSubItemGroup>
            </NavCategory>
          </NavDrawerBody>
        </NavDrawer>
      </Section>

      <Section title="Overlays — Menu · Popover · Tooltip · Dialog · Drawer · Teaching">
        <Menu>
          <MenuTrigger disableButtonEnhancement><MenuButton>메뉴</MenuButton></MenuTrigger>
          <MenuPopover><MenuList><MenuItem>레이더</MenuItem><MenuItem>위성</MenuItem><MenuItem>낙뢰</MenuItem></MenuList></MenuPopover>
        </Menu>
        <Popover>
          <PopoverTrigger disableButtonEnhancement><Button>Popover</Button></PopoverTrigger>
          <PopoverSurface><Body1>37.2°N 126.8°E · 착빙 中 · −9°C</Body1></PopoverSurface>
        </Popover>
        <Tooltip content="격자값 읽기" relationship="label"><Button>Tooltip</Button></Tooltip>
        <Dialog>
          <DialogTrigger disableButtonEnhancement><Button appearance="primary">Dialog</Button></DialogTrigger>
          <DialogSurface><DialogBody>
            <DialogTitle>브리핑 생성</DialogTitle>
            <DialogContent>RKSS → RKPC 브리핑을 생성할까요?</DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement><Button appearance="secondary">취소</Button></DialogTrigger>
              <Button appearance="primary">생성</Button>
            </DialogActions>
          </DialogBody></DialogSurface>
        </Dialog>
        <Button onClick={() => setDrawer(true)}>Drawer 열기</Button>
        <OverlayDrawer open={drawer} position="end" onOpenChange={(_, d) => setDrawer(d.open)}>
          <DrawerHeader><DrawerHeaderTitle>레이어 패널</DrawerHeaderTitle></DrawerHeader>
          <DrawerBody><Body1>레이더 · 착빙 · 난류 · 바람</Body1></DrawerBody>
        </OverlayDrawer>
        <TeachingPopover>
          <TeachingPopoverTrigger><Button>Teaching</Button></TeachingPopoverTrigger>
          <TeachingPopoverSurface>
            <TeachingPopoverHeader>사용 팁</TeachingPopoverHeader>
            <TeachingPopoverBody><TeachingPopoverTitle>picker</TeachingPopoverTitle><Body1>지도에 호버하면 격자값을 읽어요.</Body1></TeachingPopoverBody>
          </TeachingPopoverSurface>
        </TeachingPopover>
        <Button onClick={() => dispatchToast(<Toast><ToastTitle>저장됨</ToastTitle><ToastBody>브리핑 생성 완료</ToastBody></Toast>, { intent: 'success' })}>Toast 띄우기</Button>
      </Section>

      <Section title="MessageBar (상태 알림)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 460 }}>
          <MessageBar intent="info"><MessageBarBody><MessageBarTitle>안내</MessageBarTitle> KIM 자료 0914Z 갱신됨</MessageBarBody></MessageBar>
          <MessageBar intent="success"><MessageBarBody><MessageBarTitle>정상</MessageBarTitle> 출발공항 VFR</MessageBarBody></MessageBar>
          <MessageBar intent="warning"><MessageBarBody><MessageBarTitle>주의</MessageBarTitle> 노선 중 착빙 中 구간</MessageBarBody></MessageBar>
          <MessageBar intent="error"><MessageBarBody><MessageBarTitle>위험</MessageBarTitle> SIGMET ICE 경로 조우</MessageBarBody></MessageBar>
        </div>
      </Section>

      <Section title="Accordion · Tree">
        <div style={{ width: 320 }}>
          <Accordion collapsible defaultOpenItems="1">
            <AccordionItem value="1"><AccordionHeader>위험 요약</AccordionHeader><AccordionPanel><Body1>위험기상 1건</Body1></AccordionPanel></AccordionItem>
            <AccordionItem value="2"><AccordionHeader>현재 실황</AccordionHeader><AccordionPanel><Body1>RKSS VFR · RKPC IFR</Body1></AccordionPanel></AccordionItem>
          </Accordion>
        </div>
        <div style={{ width: 280 }}>
          <Tree aria-label="layers">
            <TreeItem itemType="branch">
              <TreeItemLayout>기상 레이어</TreeItemLayout>
              <Tree>
                <TreeItem itemType="leaf"><TreeItemLayout>레이더</TreeItemLayout></TreeItem>
                <TreeItem itemType="leaf"><TreeItemLayout>착빙</TreeItemLayout></TreeItem>
              </Tree>
            </TreeItem>
          </Tree>
        </div>
      </Section>

      <Section title="Card · Carousel">
        <Card style={{ width: 240 }}>
          <CardHeader header={<Body1><b>RKPC</b> 도착</Body1>} description={<Caption1>IFR · BKN008</Caption1>} />
          <CardPreview style={{ height: 64, background: '#222b3a' }} />
          <CardFooter><Button size="small">상세</Button></CardFooter>
        </Card>
        <div style={{ width: 360 }}>
          <Carousel groupSize={1} announcement={() => '슬라이드'}>
            <CarouselSlider>
              <CarouselCard style={{ height: 80, background: '#eef1f5', borderRadius: 8, padding: 14 }}>슬라이드 1</CarouselCard>
              <CarouselCard style={{ height: 80, background: '#e2e6ec', borderRadius: 8, padding: 14 }}>슬라이드 2</CarouselCard>
            </CarouselSlider>
          </Carousel>
        </div>
      </Section>

      <Section title="Persona · Avatar · Badge · Tag">
        <Persona name="조 코딩" secondaryText="기상 담당" presence={{ status: 'available' }} />
        <AvatarGroup layout="stack"><AvatarGroupItem name="김기상" /><AvatarGroupItem name="이관제" /><AvatarGroupItem name="박조종" /></AvatarGroup>
        <Avatar name="관제사" badge={{ status: 'busy' }} />
        <PresenceBadge status="available" /><PresenceBadge status="busy" /><PresenceBadge status="away" />
        <Badge appearance="filled" color="danger">IFR</Badge>
        <Badge appearance="filled" color="success">VFR</Badge>
        <Badge appearance="tint" color="brand">SIGMET</Badge>
        <CounterBadge count={3} />
        <TagGroup><Tag>RKSS</Tag><Tag dismissible>착빙</Tag></TagGroup>
      </Section>

      <Section title="Progress · Spinner · Skeleton">
        <div style={{ width: 180 }}><ProgressBar value={0.6} /></div>
        <div style={{ width: 180 }}><ProgressBar /></div>
        <Spinner size="tiny" /><Spinner label="불러오는 중" />
        <div style={{ width: 200 }}><Skeleton><SkeletonItem /></Skeleton></div>
      </Section>

      <Section title="Link · Divider">
        <Link href="#" onClick={(e) => e.preventDefault()}>사용 가이드 보기</Link>
        <div style={{ width: 200 }}><Divider /></div>
      </Section>

      <Section title="Table">
        <Table style={{ minWidth: 420 }}>
          <TableHeader><TableRow><TableHeaderCell>공항</TableHeaderCell><TableHeaderCell>카테고리</TableHeaderCell><TableHeaderCell>시정</TableHeaderCell></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>RKSS</TableCell><TableCell>VFR</TableCell><TableCell>9999</TableCell></TableRow>
            <TableRow><TableCell>RKPC</TableCell><TableCell>IFR</TableCell><TableCell>2800</TableCell></TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="DataGrid (정렬 가능 표)">
        <DataGrid items={GRID_ITEMS} columns={GRID_COLS} getRowId={(i) => i.icao} sortable style={{ minWidth: 420 }}>
          <DataGridHeader><DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow></DataGridHeader>
          <DataGridBody>{({ item, rowId }) => <DataGridRow key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}</DataGridBody>
        </DataGrid>
      </Section>
    </div>
  )
}

export default function DesignTestPage() {
  const [dark, setDark] = useState(false)
  return (
    <FluentProvider theme={dark ? appDarkTheme : appLightTheme}>
      <div style={{ height: '100vh', overflowY: 'auto', padding: 32, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 16, flexWrap: 'wrap' }}>
          <Title3>진짜 Fluent 2 컴포넌트 갤러리 (/test)</Title3>
          <Switch label={dark ? '다크' : '라이트'} checked={dark} onChange={(_, d) => setDark(d.checked)} />
        </div>
        <Body1 style={{ display: 'block', opacity: 0.7, marginBottom: 20 }}>
          @fluentui/react-components 실물 + Pretendard(자체 호스팅) + 공용 토큰. 본체 미반영(미리보기 전용).
        </Body1>
        <Divider style={{ marginBottom: 24 }} />
        <Gallery />
      </div>
    </FluentProvider>
  )
}
