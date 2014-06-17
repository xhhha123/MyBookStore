<%@ Page Title="Home Page" Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true"
    CodeBehind="UploadCompleted.aspx.cs" Inherits="MyBookstoreApplication._UploadCompleted" %>

<asp:Content ID="HeaderContent" runat="server" ContentPlaceHolderID="HeadContent">
</asp:Content>
<asp:Content ID="BodyContent" runat="server" ContentPlaceHolderID="MainContent">
    <h2>
       Upload Completed
    </h2>

    <div>
    <a href="Upload.aspx">Upload Another</a>
    <br />
    <a href="Documents.aspx">View all Documents</a>
    </div>
</asp:Content>
