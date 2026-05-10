import React from "react";
import { Card, ActionButton, Shell } from "../components/ui";
import { APP_VERSION } from "../config/version";

const purple = "#4B257A";
const lightPurple = "#F4ECFF";
const green = "#7BC043";
const amber = "#F59E0B";
const slate = "#334155";

function GuideSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 space-y-4 shadow-sm">
      <div className="space-y-1">
        <div className="text-2xl font-bold text-slate-800">{title}</div>
        {subtitle ? (
          <div className="text-sm text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function Bullet({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-2 h-2.5 w-2.5 rounded-full shrink-0"
        style={{ background: purple }}
      />
      <div className="text-slate-700 leading-7">
        {title ? <span className="font-semibold text-slate-800">{title} </span> : null}
        {children}
      </div>
    </div>
  );
}

function MiniCard({
  title,
  body,
  color,
}: {
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="font-semibold text-slate-800">{title}</div>
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}

export default function AppGuideScreen({ setScreen }: any) {
  return (
    <Shell
      title="App Guide"
      subtitle="Use the Decal Monkey Field App clearly, quickly, and consistently"
    >
      <div className="space-y-6">
        <div
          className="rounded-3xl p-6 md:p-8 text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${purple} 0%, #6D28D9 100%)`,
          }}
        >
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-1 text-sm font-semibold tracking-wide">
              Decal Monkey Field App
            </div>

            <div className="text-3xl md:text-4xl font-bold leading-tight">
              Built for fast field work, clean handoff, and fewer mistakes.
            </div>

            <div className="text-base md:text-lg leading-8 text-purple-100">
              This app helps Decal Monkey capture inquiries, build quotes, take
              field measurements, and complete installs while staying tied to
              Printavo. It is meant to keep reps and installers moving without
              losing important job details.
            </div>
          </div>
        </div>

        <GuideSection
          title="What each section does"
          subtitle="These are the main areas of the app and when to use them."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MiniCard
              title="New Order"
              color={purple}
              body="Use this when the customer is ready for a real quote. Build out customer info, products, line items, artwork details, field notes, and submission review."
            />
            <MiniCard
              title="Inquiry"
              color={amber}
              body="Use this for quick lead intake when someone is asking questions or is not ready for a full quote yet. This sends lead details straight into Printavo inquiries."
            />
            <MiniCard
              title="Offsite Measurements"
              color={green}
              body="Use this when a quote needs site photos, real measurements, placement notes, surface notes, or markup before production can continue."
            />
            <MiniCard
              title="Installer"
              color={slate}
              body="Use this for jobs in ORDER READY FOR INSTALL. Review instructions, reference artwork, customer info, maps, and complete the install report."
            />
            <MiniCard
              title="Submission History"
              color={purple}
              body="Use this to review sent order submissions, Pending Sync items, and completed install reports. Jobs can be reopened and updated from here."
            />
            <MiniCard
              title="Settings"
              color={slate}
              body="Use this for device info, connection settings, app logins, active session controls, changelog access, and other setup tools."
            />
          </div>
        </GuideSection>

        <GuideSection
          title="Recommended workflow"
          subtitle="This is the cleanest path for most jobs."
        >
          <div className="space-y-4">
            <Bullet title="1. Inquiry:">
              Use Inquiry when a customer is still shopping, asking questions,
              or just needs fast lead capture without a full quote build.
            </Bullet>

            <Bullet title="2. New Order:">
              Use New Order when the customer is ready for a real quote and the
              job needs to be built out with the details the shop will use.
            </Bullet>

            <Bullet title="3. Offsite Measurements:">
              Move the job into OFFSITE - MEASUREMENT when field photos,
              dimensions, placement notes, or surface notes are needed before
              production.
            </Bullet>

            <Bullet title="4. Installer:">
              When the job is ready for the install crew, move it into ORDER
              READY FOR INSTALL in Printavo so it appears in the Installer list.
            </Bullet>

            <Bullet title="5. Install Report:">
              After install, submit the report so the correct status updates in
              Printavo and the completed record is saved in Submission History.
            </Bullet>
          </div>
        </GuideSection>

        <GuideSection
          title="Important field features"
          subtitle="These are some of the built-in safety nets and workflow helpers."
        >
          <div className="space-y-4">
            <Bullet title="Offline Queue:">
              If the app cannot reach Printavo, submissions can stay in
              <span className="font-semibold"> Pending Sync</span> until the
              device reconnects and the job is retried.
            </Bullet>

            <Bullet title="Submission Protection:">
              Clear History removes sent history and completed installs, but
              Pending Sync jobs stay protected so unsynced work is not lost.
            </Bullet>

            <Bullet title="Editable Install Reports:">
              Completed install reports can be reopened and updated without
              creating duplicate history cards.
            </Bullet>

            <Bullet title="Shared App Logins:">
              User access can be managed from Settings, and admins can control
              active sessions across devices.
            </Bullet>

            <Bullet title="Back Button Protection:">
              The app warns the user before exiting so the browser back button
              does not accidentally kick them out while working.
            </Bullet>

            <Bullet title="Device & App Info:">
              Leave Device Name blank and save to let the app auto-detect the
              current device and browser name.
            </Bullet>
          </div>
        </GuideSection>

        <GuideSection
          title="What reps should capture clearly"
          subtitle="A clean job going in saves the shop time later."
        >
          <div className="space-y-4">
            <Bullet>
              Make sure customer name, company, phone, email, and address are correct.
            </Bullet>
            <Bullet>
              Use line items clearly so the job reflects what is actually being made.
            </Bullet>
            <Bullet>
              Add artwork instructions that make sense to the shop, not just to the rep.
            </Bullet>
            <Bullet>
              Use field notes for anything the next person needs to know.
            </Bullet>
            <Bullet>
              Use markup on photos to show placement, obstacles, clearances, and
              special install notes.
            </Bullet>
          </div>
        </GuideSection>

        <GuideSection
          title="Artwork rule for install jobs"
          subtitle="This matters for the installer experience."
        >
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: "#FCD34D",
              background: "#FFFBEB",
            }}
          >
            <div className="text-lg font-bold text-amber-900">
              Installer artwork warning
            </div>
            <div className="mt-2 leading-7 text-amber-900">
              Install artwork should be attached in the{" "}
              <span className="font-semibold">imprint area</span> before a job
              is moved to{" "}
              <span className="font-semibold">ORDER READY FOR INSTALL</span>.
              If artwork is attached somewhere else in Printavo, the installer
              app may not be able to show it correctly.
            </div>
          </div>

          <div className="text-slate-700 leading-7">
            For cleaner installs and fewer surprises in the field, make sure
            each install-ready line item has the artwork and mockup attached
            where the app expects it.
          </div>
        </GuideSection>

        <GuideSection
          title="Good habits for the team"
          subtitle="These little habits keep the workflow cleaner."
        >
          <div className="space-y-4">
            <Bullet>
              Use Inquiry for quick lead capture and New Order for full quoting.
              That keeps the workflow cleaner for the shop.
            </Bullet>

            <Bullet>
              If a measurement job needs more photos later, reopen it from
              Offsite Measurements instead of creating a duplicate path.
            </Bullet>

            <Bullet>
              If a job is moved back into install-ready status in Printavo,
              refresh the Installer list so it appears again.
            </Bullet>

            <Bullet>
              Always double-check that the customer address, contact info, and
              install notes are complete before the crew heads out.
            </Bullet>

            <Bullet>
              Use Submission History to review what was sent, what is still
              pending, and what was completed.
            </Bullet>
          </div>
        </GuideSection>

        <div className="flex gap-3 flex-wrap">
          <ActionButton
            variant="secondary"
            onClick={() => setScreen("settings")}
          >
            Back to Settings
          </ActionButton>

          <ActionButton onClick={() => setScreen("home")}>
            Back to Home
          </ActionButton>
        </div>

        <div
          className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm"
          style={{ background: lightPurple }}
        >
          <div className="text-sm font-semibold text-slate-700">
            Decal Monkey Field App • Version {APP_VERSION}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Designed and created by Bart @ Decal Monkey LLC
          </div>
        </div>
      </div>
    </Shell>
  );
}
